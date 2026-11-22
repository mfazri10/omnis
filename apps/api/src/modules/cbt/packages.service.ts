import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Db } from "../../database/database.service";
import { ActivityLogService } from "../platform/activity-logs/activity-log.service";
import type { CbtPassingGrade, CbtPackageRow } from "./entities/packages.entity";
import type { CbtPackageFilters } from "./packages.repository";
import { CbtPackagesRepository } from "./packages.repository";
import { CbtQuestionsRepository } from "./questions.repository";
import type { CbtAuditContext, CbtQuestionItem } from "./questions.service";

export interface CreateCbtPackageData {
  title: string;
  description?: string | null;
  durationMinutes?: number;
  passingGrade: CbtPassingGrade;
}

export type UpdateCbtPackageData = Partial<CreateCbtPackageData> & {
  isActive?: boolean;
};

/** Bentuk paket yang dikembalikan service ke resolver. */
export interface CbtPackageItem {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  passingGrade: CbtPassingGrade;
  isActive: boolean;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CbtPackageDetailItem extends CbtPackageItem {
  questions: CbtQuestionItem[];
}

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
const DEFAULT_DURATION = 100;

/** Paket ujian CBT (F12): komposisi soal eksplisit + passing grade. */
@Injectable()
export class CbtPackagesService {
  constructor(
    private readonly packages: CbtPackagesRepository,
    private readonly questions: CbtQuestionsRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  async list(
    input: { filter?: CbtPackageFilters; page?: number; perPage?: number },
    db: Db,
  ): Promise<{ items: CbtPackageItem[]; total: number }> {
    const page = positiveOr(input.page, DEFAULT_PAGE);
    const perPage = Math.min(positiveOr(input.perPage, DEFAULT_PER_PAGE), MAX_PER_PAGE);
    const filters = input.filter ?? {};
    const [rows, total] = await Promise.all([
      this.packages.list(db, filters, { limit: perPage, offset: (page - 1) * perPage }),
      this.packages.count(db, filters),
    ]);
    const items = await Promise.all(
      rows.map(async (row) => ({
        ...toItem(row),
        questionCount: await this.packages.countQuestions(db, row.id),
      })),
    );
    return { items, total };
  }

  /** Detail paket + komposisi soal terurut (satu join, bukan N+1). */
  async getDetail(id: string, db: Db): Promise<CbtPackageDetailItem> {
    const row = await this.mustExist(id, db);
    const questions = await this.packages.listQuestions(db, row.id);
    return {
      ...toItem(row),
      questionCount: questions.length,
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
    };
  }

  async create(
    data: CreateCbtPackageData,
    db: Db,
    audit: CbtAuditContext,
  ): Promise<CbtPackageItem> {
    this.validatePassingGrade(data.passingGrade);
    const created = await this.packages.insert(db, {
      title: data.title.trim(),
      description: data.description ?? null,
      durationMinutes: data.durationMinutes ?? DEFAULT_DURATION,
      passingGrade: data.passingGrade,
    });
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "create",
      entityType: "cbt_package",
      entityId: String(created.id),
      summary: `Membuat paket CBT "${created.title}"`,
      ip: audit.ip,
    });
    return { ...toItem(created), questionCount: 0 };
  }

  async update(
    id: string,
    data: UpdateCbtPackageData,
    db: Db,
    audit: CbtAuditContext,
  ): Promise<CbtPackageItem> {
    const row = await this.mustExist(id, db);
    if (data.passingGrade !== undefined) {
      this.validatePassingGrade(data.passingGrade);
    }
    const updated = await this.packages.update(db, row.id, {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.durationMinutes !== undefined
        ? { durationMinutes: data.durationMinutes }
        : {}),
      ...(data.passingGrade !== undefined ? { passingGrade: data.passingGrade } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      updatedAt: new Date(),
    });
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "update",
      entityType: "cbt_package",
      entityId: String(updated.id),
      summary: `Mengubah paket CBT "${updated.title}"`,
      ip: audit.ip,
    });
    const questionCount = await this.packages.countQuestions(db, updated.id);
    return { ...toItem(updated), questionCount };
  }

  /**
   * Ganti komposisi soal: semua id wajib ada dan aktif; duplikat
   * ditolak; urutan array menjadi urutan penyajian soal.
   */
  async setQuestions(
    id: string,
    questionIds: string[],
    db: Db,
    audit: CbtAuditContext,
  ): Promise<CbtPackageDetailItem> {
    const row = await this.mustExist(id, db);
    const numericIds = questionIds.map((qid) => this.parseId(qid));
    if (new Set(numericIds).size !== numericIds.length) {
      throw new BadRequestException("Soal duplikat dalam komposisi paket.");
    }
    if (numericIds.length > 0) {
      const found = await this.questions.listByIds(db, numericIds);
      const foundById = new Map(found.map((question) => [question.id, question]));
      for (const qid of numericIds) {
        const question = foundById.get(qid);
        if (!question) {
          throw new BadRequestException(`Soal #${qid} tidak ditemukan.`);
        }
        if (!question.isActive) {
          throw new BadRequestException(
            `Soal #${qid} nonaktif; aktifkan dulu sebelum dimasukkan ke paket.`,
          );
        }
      }
    }
    await this.packages.replaceQuestions(db, row.id, numericIds);
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "update",
      entityType: "cbt_package",
      entityId: String(row.id),
      summary: `Mengatur komposisi paket "${row.title}" (${numericIds.length} soal)`,
      ip: audit.ip,
    });
    return this.getDetail(id, db);
  }

  private async mustExist(id: string, db: Db): Promise<CbtPackageRow> {
    const row = await this.packages.findById(db, this.parseId(id));
    if (!row) {
      throw new NotFoundException("Paket tidak ditemukan.");
    }
    return row;
  }

  private validatePassingGrade(grade: CbtPassingGrade): void {
    for (const key of ["twk", "tiu", "tkp"] as const) {
      const value = grade[key];
      if (!Number.isInteger(value) || value < 0) {
        throw new BadRequestException(
          "Passing grade harus bilangan bulat >= 0 untuk tiap kategori.",
        );
      }
    }
  }

  private parseId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }
}

function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function toItem(row: {
  id: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  passingGrade: CbtPassingGrade;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Omit<CbtPackageItem, "questionCount"> {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    durationMinutes: row.durationMinutes,
    passingGrade: row.passingGrade,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
