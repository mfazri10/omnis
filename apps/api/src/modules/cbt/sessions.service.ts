import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Db } from "../../database/database.service";
import { ActivityLogService } from "../platform/activity-logs/activity-log.service";
import { AppUsersRepository } from "../platform/app-users/app-users.repository";
import type { CbtOption } from "./entities/questions.entity";
import type { CbtPackageRow } from "./entities/packages.entity";
import type { CbtSessionRow } from "./entities/sessions.entity";
import type { CbtSessionFilters } from "./sessions.repository";
import { CbtSessionsRepository } from "./sessions.repository";
import { CbtPackagesRepository } from "./packages.repository";
import type { CbtPackageItem } from "./packages.service";
import type { CbtAuditContext, CbtQuestionItem } from "./questions.service";
import { scoreSession } from "./scoring";

export interface StartCbtSimulationData {
  packageId: string;
  appUserId?: string | null;
  participantName?: string | null;
}

export interface SubmitCbtAnswerData {
  questionId: string;
  selectedOption?: CbtOption | null;
}

/** Bentuk sesi yang dikembalikan service ke resolver. */
export interface CbtSessionItem {
  id: string;
  packageId: string;
  packageTitle: string;
  appUserId: string | null;
  participantName: string;
  status: "ongoing" | "completed";
  startedAt: Date;
  finishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface CbtAnswerItem {
  questionId: string;
  selectedOption: CbtOption | null;
}

export interface CbtResultItem {
  id: string;
  sessionId: string;
  participantName: string;
  packageId: string;
  packageTitle: string;
  twkScore: number;
  tiuScore: number;
  tkpScore: number;
  totalScore: number;
  passed: boolean;
  computedAt: Date;
  finishedAt: Date | null;
}

export interface CbtSessionDetailItem {
  session: CbtSessionItem;
  package: CbtPackageItem;
  questions: CbtQuestionItem[];
  answers: CbtAnswerItem[];
  result: CbtResultItem | null;
}

export interface CbtPackageStatsItem {
  packageId: string;
  completed: number;
  passedCount: number;
  passRate: number;
  avgTotal: number | null;
  avgTwk: number | null;
  avgTiu: number | null;
  avgTkp: number | null;
  maxTotal: number | null;
  minTotal: number | null;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/**
 * Sesi ujian CBT (F12). Fase CMS: simulasi penilaian (PRD §7.3) —
 * admin memulai sesi untuk peserta, mengisi jawaban, lalu menyelesaikan
 * sesi; skor dihitung otomatis (TWK/TIU benar=5; TKP bobot 1..5) dan
 * dibandingkan dengan passing grade paket per kategori.
 */
@Injectable()
export class CbtSessionsService {
  constructor(
    private readonly sessions: CbtSessionsRepository,
    private readonly packages: CbtPackagesRepository,
    private readonly appUsers: AppUsersRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  async listSessions(
    input: { filter?: CbtSessionFilters; page?: number; perPage?: number },
    db: Db,
  ): Promise<{ items: CbtSessionItem[]; total: number }> {
    const page = positiveOr(input.page, DEFAULT_PAGE);
    const perPage = Math.min(positiveOr(input.perPage, DEFAULT_PER_PAGE), MAX_PER_PAGE);
    const filters = input.filter ?? {};
    if (filters.packageId !== undefined) {
      this.assertPositiveInt(filters.packageId, "ID paket");
    }
    const [rows, total] = await Promise.all([
      this.sessions.list(db, filters, { limit: perPage, offset: (page - 1) * perPage }),
      this.sessions.count(db, filters),
    ]);
    return { items: rows.map(sessionItem), total };
  }

  async startSimulation(
    data: StartCbtSimulationData,
    db: Db,
    audit: CbtAuditContext,
  ): Promise<CbtSessionDetailItem> {
    const pkg = await this.packages.findById(db, this.parseId(data.packageId));
    if (!pkg) {
      throw new NotFoundException("Paket tidak ditemukan.");
    }
    if (!pkg.isActive) {
      throw new BadRequestException("Paket nonaktif; aktifkan dulu sebelum memulai simulasi.");
    }
    const questions = await this.packages.listQuestions(db, pkg.id);
    if (questions.length === 0) {
      throw new BadRequestException(
        "Paket belum memiliki soal. Susun komposisi paket dulu.",
      );
    }
    const participant = await this.resolveParticipant(data, db);
    const created = await this.sessions.insert(db, {
      packageId: pkg.id,
      appUserId: participant.appUserId,
      participantName: participant.name,
      createdBy: this.parseId(audit.adminId),
    });
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "create",
      entityType: "cbt_session",
      entityId: String(created.id),
      summary: `Memulai simulasi CBT paket "${pkg.title}" untuk ${participant.name}`,
      ip: audit.ip,
    });
    return this.getDetail(String(created.id), db);
  }

  async submitAnswers(
    sessionId: string,
    answers: SubmitCbtAnswerData[],
    db: Db,
  ): Promise<CbtSessionDetailItem> {
    const session = await this.mustBeOngoing(sessionId, db);
    const questions = await this.packages.listQuestions(db, session.packageId);
    const inPackage = new Set(questions.map((question) => question.id));
    const rows = answers.map((answer) => {
      const questionId = this.parseId(answer.questionId);
      if (!inPackage.has(questionId)) {
        throw new BadRequestException(
          `Soal #${questionId} bukan bagian dari paket sesi ini.`,
        );
      }
      return { questionId, selectedOption: answer.selectedOption ?? null };
    });
    await this.sessions.upsertAnswers(db, session.id, rows);
    return this.getDetail(sessionId, db);
  }

  /** Selesaikan sesi: penilaian otomatis + hasil + audit. */
  async finish(
    sessionId: string,
    db: Db,
    audit: CbtAuditContext,
  ): Promise<CbtSessionDetailItem> {
    const session = await this.mustBeOngoing(sessionId, db);
    const pkg = await this.packages.findById(db, session.packageId);
    if (!pkg) {
      throw new NotFoundException("Paket tidak ditemukan.");
    }
    const questions = await this.packages.listQuestions(db, pkg.id);
    const answers = await this.sessions.listAnswers(db, session.id);
    const detail = scoreSession(
      questions,
      answers.map((answer) => ({
        questionId: answer.questionId,
        selectedOption: answer.selectedOption,
      })),
      pkg.passingGrade,
    );
    const now = new Date();
    const result = await this.sessions.insertResult(db, {
      sessionId: session.id,
      twkScore: detail.twkScore,
      tiuScore: detail.tiuScore,
      tkpScore: detail.tkpScore,
      totalScore: detail.totalScore,
      passed: detail.passed,
    });
    await this.sessions.markCompleted(db, session.id, now);
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "finish",
      entityType: "cbt_session",
      entityId: String(session.id),
      summary:
        `Menyelesaikan simulasi CBT ${session.participantName}: ` +
        `total ${detail.totalScore}, ${detail.passed ? "lulus" : "tidak lulus"}`,
      ip: audit.ip,
    });
    void result;
    return this.getDetail(sessionId, db);
  }

  async getDetail(sessionId: string, db: Db): Promise<CbtSessionDetailItem> {
    const session = await this.sessions.findById(db, this.parseId(sessionId));
    if (!session) {
      throw new NotFoundException("Sesi tidak ditemukan.");
    }
    const pkg = await this.packages.findById(db, session.packageId);
    if (!pkg) {
      throw new NotFoundException("Paket tidak ditemukan.");
    }
    const [questions, answers, result] = await Promise.all([
      this.packages.listQuestions(db, pkg.id),
      this.sessions.listAnswers(db, session.id),
      this.sessions.findResultBySession(db, session.id),
    ]);
    const packageTitle = pkg.title;
    return {
      session: { ...sessionItem({ ...session, packageTitle }) },
      package: {
        id: String(pkg.id),
        title: pkg.title,
        description: pkg.description,
        durationMinutes: pkg.durationMinutes,
        passingGrade: pkg.passingGrade,
        isActive: pkg.isActive,
        questionCount: questions.length,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      },
      questions: questions.map((question) => ({
        id: String(question.id),
        category: question.category,
        stem: question.stem,
        imageUrl: question.imageUrl,
        optionA: question.optionA,
        optionB: question.optionB,
        optionC: question.optionC,
        optionD: question.optionD,
        optionE: question.optionE,
        correctOption: question.correctOption,
        tkpWeights: question.tkpWeights,
        explanation: question.explanation,
        isActive: question.isActive,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      })),
      answers: answers.map((answer) => ({
        questionId: String(answer.questionId),
        selectedOption: answer.selectedOption,
      })),
      result: result
        ? resultItem(result, session.participantName, pkg, session.finishedAt)
        : null,
    };
  }

  async listResults(
    input: { filter?: { packageId?: number; passed?: boolean }; page?: number; perPage?: number },
    db: Db,
  ): Promise<{ items: CbtResultItem[]; total: number }> {
    const page = positiveOr(input.page, DEFAULT_PAGE);
    const perPage = Math.min(positiveOr(input.perPage, DEFAULT_PER_PAGE), MAX_PER_PAGE);
    const filters = input.filter ?? {};
    if (filters.packageId !== undefined) {
      this.assertPositiveInt(filters.packageId, "ID paket");
    }
    const [rows, total] = await Promise.all([
      this.sessions.listResults(db, filters, { limit: perPage, offset: (page - 1) * perPage }),
      this.sessions.countResults(db, filters),
    ]);
    return {
      items: rows.map((row) => ({
        id: String(row.id),
        sessionId: String(row.sessionId),
        participantName: row.participantName,
        packageId: String(row.packageId),
        packageTitle: row.packageTitle,
        twkScore: row.twkScore,
        tiuScore: row.tiuScore,
        tkpScore: row.tkpScore,
        totalScore: row.totalScore,
        passed: row.passed,
        computedAt: row.computedAt,
        finishedAt: row.finishedAt,
      })),
      total,
    };
  }

  async packageStats(packageId: string, db: Db): Promise<CbtPackageStatsItem> {
    const pkg = await this.packages.findById(db, this.parseId(packageId));
    if (!pkg) {
      throw new NotFoundException("Paket tidak ditemukan.");
    }
    const stats = await this.sessions.statsByPackage(db, pkg.id);
    return {
      packageId: String(pkg.id),
      completed: stats.completed,
      passedCount: stats.passedCount,
      passRate:
        stats.completed > 0
          ? Math.round((stats.passedCount / stats.completed) * 1000) / 10
          : 0,
      avgTotal: stats.avgTotal,
      avgTwk: stats.avgTwk,
      avgTiu: stats.avgTiu,
      avgTkp: stats.avgTkp,
      maxTotal: stats.maxTotal,
      minTotal: stats.minTotal,
    };
  }

  private async resolveParticipant(
    data: StartCbtSimulationData,
    db: Db,
  ): Promise<{ appUserId: number | null; name: string }> {
    if (data.appUserId !== undefined && data.appUserId !== null) {
      const user = await this.appUsers.findById(db, this.parseId(data.appUserId));
      if (!user) {
        throw new BadRequestException("Peserta (user aplikasi) tidak ditemukan.");
      }
      if (!user.isActive) {
        throw new BadRequestException("Peserta nonaktif; pilih user aplikasi yang aktif.");
      }
      return { appUserId: user.id, name: user.name };
    }
    const name = data.participantName?.trim();
    if (!name) {
      throw new BadRequestException(
        "Peserta wajib diisi: pilih user aplikasi atau ketik nama peserta.",
      );
    }
    return { appUserId: null, name };
  }

  private async mustBeOngoing(sessionId: string, db: Db): Promise<CbtSessionRow> {
    const session = await this.sessions.findById(db, this.parseId(sessionId));
    if (!session) {
      throw new NotFoundException("Sesi tidak ditemukan.");
    }
    if (session.status !== "ongoing") {
      throw new BadRequestException("Sesi sudah selesai; jawaban tidak bisa diubah.");
    }
    return session;
  }

  private parseId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }

  private assertPositiveInt(value: number, label: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${label} tidak valid.`);
    }
  }
}

function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function sessionItem(row: {
  id: number;
  packageId: number;
  packageTitle: string;
  appUserId: number | null;
  participantName: string;
  status: "ongoing" | "completed";
  startedAt: Date;
  finishedAt: Date | null;
  createdBy: number;
  createdAt: Date;
}): CbtSessionItem {
  return {
    id: String(row.id),
    packageId: String(row.packageId),
    packageTitle: row.packageTitle,
    appUserId: row.appUserId === null ? null : String(row.appUserId),
    participantName: row.participantName,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdBy: String(row.createdBy),
    createdAt: row.createdAt,
  };
}

function resultItem(
  row: {
    id: number;
    sessionId: number;
    twkScore: number;
    tiuScore: number;
    tkpScore: number;
    totalScore: number;
    passed: boolean;
    computedAt: Date;
  },
  participantName: string,
  pkg: CbtPackageRow,
  finishedAt: Date | null,
): CbtResultItem {
  return {
    id: String(row.id),
    sessionId: String(row.sessionId),
    participantName,
    packageId: String(pkg.id),
    packageTitle: pkg.title,
    twkScore: row.twkScore,
    tiuScore: row.tiuScore,
    tkpScore: row.tkpScore,
    totalScore: row.totalScore,
    passed: row.passed,
    computedAt: row.computedAt,
    finishedAt,
  };
}
