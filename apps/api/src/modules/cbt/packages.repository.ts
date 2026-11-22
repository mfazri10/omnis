import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../../database/database.service";
import type { CbtPassingGrade, CbtPackageRow } from "./entities/packages.entity";
import { cbtPackages } from "./entities/packages.entity";
import { cbtPackageQuestions } from "./entities/package-questions.entity";
import type { CbtQuestionRow } from "./entities/questions.entity";
import { cbtQuestions } from "./entities/questions.entity";

export interface CbtPackageFilters {
  search?: string;
  isActive?: boolean;
}

export interface InsertCbtPackageRow {
  title: string;
  description: string | null;
  durationMinutes: number;
  passingGrade: CbtPassingGrade;
}

export interface UpdateCbtPackageRow extends Partial<InsertCbtPackageRow> {
  isActive?: boolean;
  updatedAt: Date;
}

function toConditions(filters: CbtPackageFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.isActive !== undefined) {
    conditions.push(eq(cbtPackages.isActive, filters.isActive));
  }
  const term = filters.search?.trim();
  if (term !== undefined && term !== "") {
    conditions.push(ilike(cbtPackages.title, `%${term}%`));
  }
  return conditions;
}

@Injectable()
export class CbtPackagesRepository {
  async list(
    db: Db,
    filters: CbtPackageFilters,
    pagination: { limit: number; offset: number },
  ): Promise<CbtPackageRow[]> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db
      .select()
      .from(cbtPackages)
      .where(where)
      .orderBy(desc(cbtPackages.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
  }

  async count(db: Db, filters: CbtPackageFilters): Promise<number> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(cbtPackages)
      .where(where);
    return rows[0]?.value ?? 0;
  }

  async findById(db: Db, id: number): Promise<CbtPackageRow | null> {
    const rows = await db
      .select()
      .from(cbtPackages)
      .where(eq(cbtPackages.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async insert(db: Db, row: InsertCbtPackageRow): Promise<CbtPackageRow> {
    const rows = await db.insert(cbtPackages).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal membuat paket CBT.");
    }
    return created;
  }

  async update(
    db: Db,
    id: number,
    patch: UpdateCbtPackageRow,
  ): Promise<CbtPackageRow> {
    const rows = await db
      .update(cbtPackages)
      .set(patch)
      .where(eq(cbtPackages.id, id))
      .returning();
    const updated = rows[0];
    if (!updated) {
      throw new Error("Gagal mengubah paket CBT.");
    }
    return updated;
  }

  /** Soal paket terurut sesuai komposisi (join, bukan N+1). */
  async listQuestions(db: Db, packageId: number): Promise<CbtQuestionRow[]> {
    return db
      .select({ question: cbtQuestions })
      .from(cbtPackageQuestions)
      .innerJoin(
        cbtQuestions,
        eq(cbtQuestions.id, cbtPackageQuestions.questionId),
      )
      .where(eq(cbtPackageQuestions.packageId, packageId))
      .orderBy(asc(cbtPackageQuestions.sortOrder))
      .then((rows) => rows.map((row) => row.question));
  }

  async countQuestions(db: Db, packageId: number): Promise<number> {
    const rows = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(cbtPackageQuestions)
      .where(eq(cbtPackageQuestions.packageId, packageId));
    return rows[0]?.value ?? 0;
  }

  /** Ganti komposisi paket secara utuh (urutan array = urutan soal). */
  async replaceQuestions(
    db: Db,
    packageId: number,
    questionIds: number[],
  ): Promise<void> {
    await db
      .delete(cbtPackageQuestions)
      .where(eq(cbtPackageQuestions.packageId, packageId));
    if (questionIds.length === 0) {
      return;
    }
    await db.insert(cbtPackageQuestions).values(
      questionIds.map((questionId, index) => ({
        packageId,
        questionId,
        sortOrder: index,
      })),
    );
  }
}
