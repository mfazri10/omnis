import { Injectable } from "@nestjs/common";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../../database/database.service";
import type { CbtCategory, CbtQuestionRow } from "./entities/questions.entity";
import { cbtQuestions } from "./entities/questions.entity";

export interface CbtQuestionFilters {
  category?: CbtCategory;
  search?: string;
  isActive?: boolean;
}

export interface InsertCbtQuestionRow {
  category: CbtCategory;
  stem: string;
  imageUrl: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  correctOption: "A" | "B" | "C" | "D" | "E" | null;
  tkpWeights: Record<"A" | "B" | "C" | "D" | "E", number> | null;
  explanation: string | null;
}

export interface UpdateCbtQuestionRow extends Partial<InsertCbtQuestionRow> {
  isActive?: boolean;
  updatedAt: Date;
}

function toConditions(filters: CbtQuestionFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.category !== undefined) {
    conditions.push(eq(cbtQuestions.category, filters.category));
  }
  if (filters.isActive !== undefined) {
    conditions.push(eq(cbtQuestions.isActive, filters.isActive));
  }
  const term = filters.search?.trim();
  if (term !== undefined && term !== "") {
    conditions.push(ilike(cbtQuestions.stem, `%${term}%`));
  }
  return conditions;
}

@Injectable()
export class CbtQuestionsRepository {
  async list(
    db: Db,
    filters: CbtQuestionFilters,
    pagination: { limit: number; offset: number },
  ): Promise<CbtQuestionRow[]> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db
      .select()
      .from(cbtQuestions)
      .where(where)
      .orderBy(desc(cbtQuestions.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
  }

  async count(db: Db, filters: CbtQuestionFilters): Promise<number> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(cbtQuestions)
      .where(where);
    return rows[0]?.value ?? 0;
  }

  async findById(db: Db, id: number): Promise<CbtQuestionRow | null> {
    const rows = await db
      .select()
      .from(cbtQuestions)
      .where(eq(cbtQuestions.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByIds(db: Db, ids: number[]): Promise<CbtQuestionRow[]> {
    if (ids.length === 0) {
      return [];
    }
    return db
      .select()
      .from(cbtQuestions)
      .where(inArray(cbtQuestions.id, ids));
  }

  async insert(db: Db, row: InsertCbtQuestionRow): Promise<CbtQuestionRow> {
    const rows = await db.insert(cbtQuestions).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal menambah soal CBT.");
    }
    return created;
  }

  async update(
    db: Db,
    id: number,
    patch: UpdateCbtQuestionRow,
  ): Promise<CbtQuestionRow> {
    const rows = await db
      .update(cbtQuestions)
      .set(patch)
      .where(eq(cbtQuestions.id, id))
      .returning();
    const updated = rows[0];
    if (!updated) {
      throw new Error("Gagal mengubah soal CBT.");
    }
    return updated;
  }
}
