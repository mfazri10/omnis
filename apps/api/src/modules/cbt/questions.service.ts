import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Db } from "../../database/database.service";
import { ActivityLogService } from "../platform/activity-logs/activity-log.service";
import type { CbtCategory, CbtOption, TkpWeights } from "./entities/questions.entity";
import type {
  CbtQuestionFilters,
  InsertCbtQuestionRow,
  UpdateCbtQuestionRow,
} from "./questions.repository";
import { CbtQuestionsRepository } from "./questions.repository";
import { isValidTkpWeights } from "./scoring";

export interface CbtAuditContext {
  adminId: string;
  appId: string;
  ip: string | null;
}

export interface CreateCbtQuestionData {
  category: CbtCategory;
  stem: string;
  imageUrl?: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctOption?: CbtOption | null;
  tkpWeights?: TkpWeights | null;
  explanation?: string | null;
}

export type UpdateCbtQuestionData = Partial<CreateCbtQuestionData> & {
  isActive?: boolean;
};

/** Bentuk soal yang dikembalikan service ke resolver (id GraphQL string). */
export interface CbtQuestionItem {
  id: string;
  category: CbtCategory;
  stem: string;
  imageUrl: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctOption: CbtOption | null;
  tkpWeights: TkpWeights | null;
  explanation: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/**
 * Bank soal CBT (F12). Validasi kategori di sini (bukan hanya DTO):
 * TWK/TIU wajib punya kunci jawaban; TKP wajib punya bobot 1..5 untuk
 * kelima opsi. Update memvalidasi gabungan nilai lama + perubahan.
 */
@Injectable()
export class CbtQuestionsService {
  constructor(
    private readonly questions: CbtQuestionsRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  async list(
    input: { filter?: CbtQuestionFilters; page?: number; perPage?: number },
    db: Db,
  ): Promise<{ items: CbtQuestionItem[]; total: number }> {
    const page = positiveOr(input.page, DEFAULT_PAGE);
    const perPage = Math.min(positiveOr(input.perPage, DEFAULT_PER_PAGE), MAX_PER_PAGE);
    const filters = input.filter ?? {};
    const [rows, total] = await Promise.all([
      this.questions.list(db, filters, { limit: perPage, offset: (page - 1) * perPage }),
      this.questions.count(db, filters),
    ]);
    return { items: toItems(rows), total };
  }

  async get(id: string, db: Db): Promise<CbtQuestionItem> {
    const row = await this.questions.findById(db, this.parseId(id));
    if (!row) {
      throw new NotFoundException("Soal tidak ditemukan.");
    }
    return toItem(row);
  }

  async create(
    data: CreateCbtQuestionData,
    db: Db,
    audit: CbtAuditContext,
  ): Promise<CbtQuestionItem> {
    this.validateScoringKeys(data.category, data.correctOption ?? null, data.tkpWeights ?? null);
    const row: InsertCbtQuestionRow = {
      category: data.category,
      stem: data.stem.trim(),
      imageUrl: data.imageUrl ?? null,
      optionA: data.optionA,
      optionB: data.optionB,
      optionC: data.optionC,
      optionD: data.optionD,
      optionE: data.optionE,
      correctOption: data.category === "TKP" ? null : (data.correctOption ?? null),
      tkpWeights: data.category === "TKP" ? (data.tkpWeights ?? null) : null,
      explanation: data.explanation ?? null,
    };
    const created = await this.questions.insert(db, row);
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "create",
      entityType: "cbt_question",
      entityId: String(created.id),
      summary: `Menambah soal ${created.category} #${created.id}`,
      ip: audit.ip,
    });
    return toItem(created);
  }

  async update(
    id: string,
    data: UpdateCbtQuestionData,
    db: Db,
    audit: CbtAuditContext,
  ): Promise<CbtQuestionItem> {
    const numericId = this.parseId(id);
    const existing = await this.questions.findById(db, numericId);
    if (!existing) {
      throw new NotFoundException("Soal tidak ditemukan.");
    }
    const categoryChanged =
      data.category !== undefined && data.category !== existing.category;
    // Pindah kategori: kunci penilaian kategori lama tidak diwariskan;
    // hanya nilai yang dikirim eksplisit yang dipakai (kategori baru
    // memvalidasi kelengkapannya di bawah).
    const merged = {
      category: data.category ?? existing.category,
      correctOption: categoryChanged
        ? (data.correctOption ?? null)
        : data.correctOption !== undefined
          ? data.correctOption
          : existing.correctOption,
      tkpWeights: categoryChanged
        ? (data.tkpWeights ?? null)
        : data.tkpWeights !== undefined
          ? data.tkpWeights
          : existing.tkpWeights,
    };
    this.validateScoringKeys(merged.category, merged.correctOption, merged.tkpWeights);
    const patch: UpdateCbtQuestionRow = { updatedAt: new Date() };
    if (data.category !== undefined) patch.category = data.category;
    if (data.stem !== undefined) patch.stem = data.stem.trim();
    if (data.imageUrl !== undefined) patch.imageUrl = data.imageUrl;
    if (data.optionA !== undefined) patch.optionA = data.optionA;
    if (data.optionB !== undefined) patch.optionB = data.optionB;
    if (data.optionC !== undefined) patch.optionC = data.optionC;
    if (data.optionD !== undefined) patch.optionD = data.optionD;
    if (data.optionE !== undefined) patch.optionE = data.optionE;
    if (data.explanation !== undefined) patch.explanation = data.explanation;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    // Kolom penilaian mengikuti kategori hasil gabungan.
    patch.correctOption = merged.category === "TKP" ? null : merged.correctOption;
    patch.tkpWeights = merged.category === "TKP" ? merged.tkpWeights : null;
    const updated = await this.questions.update(db, numericId, patch);
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "update",
      entityType: "cbt_question",
      entityId: String(updated.id),
      summary: `Mengubah soal ${updated.category} #${updated.id}`,
      ip: audit.ip,
    });
    return toItem(updated);
  }

  async setActive(
    id: string,
    active: boolean,
    db: Db,
    audit: CbtAuditContext,
  ): Promise<CbtQuestionItem> {
    const numericId = this.parseId(id);
    const existing = await this.questions.findById(db, numericId);
    if (!existing) {
      throw new NotFoundException("Soal tidak ditemukan.");
    }
    const updated = await this.questions.update(db, numericId, {
      isActive: active,
      updatedAt: new Date(),
    });
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "update",
      entityType: "cbt_question",
      entityId: String(updated.id),
      summary: `${active ? "Mengaktifkan" : "Menonaktifkan"} soal #${updated.id}`,
      ip: audit.ip,
    });
    return toItem(updated);
  }

  private validateScoringKeys(
    category: CbtCategory,
    correctOption: CbtOption | null,
    tkpWeights: TkpWeights | null,
  ): void {
    if (category === "TKP") {
      if (!isValidTkpWeights(tkpWeights)) {
        throw new BadRequestException(
          "Soal TKP wajib memiliki bobot 1..5 untuk kelima opsi (A sampai E).",
        );
      }
      if (correctOption !== null) {
        throw new BadRequestException(
          "Kunci jawaban hanya untuk kategori TWK/TIU; soal TKP memakai bobot per opsi.",
        );
      }
      return;
    }
    if (correctOption === null) {
      throw new BadRequestException(
        `Soal ${category} wajib memiliki kunci jawaban (A sampai E).`,
      );
    }
    if (tkpWeights !== null) {
      throw new BadRequestException(
        "Bobot TKP hanya untuk kategori TKP.",
      );
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
  category: CbtCategory;
  stem: string;
  imageUrl: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctOption: CbtOption | null;
  tkpWeights: TkpWeights | null;
  explanation: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CbtQuestionItem {
  return {
    id: String(row.id),
    category: row.category,
    stem: row.stem,
    imageUrl: row.imageUrl,
    optionA: row.optionA,
    optionB: row.optionB,
    optionC: row.optionC,
    optionD: row.optionD,
    optionE: row.optionE,
    correctOption: row.correctOption,
    tkpWeights: row.tkpWeights,
    explanation: row.explanation,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toItems(rows: Parameters<typeof toItem>[0][]): CbtQuestionItem[] {
  return rows.map(toItem);
}
