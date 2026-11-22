import { Injectable } from "@nestjs/common";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../../database/database.service";
import { cbtAnswers } from "./entities/answers.entity";
import type { CbtAnswerRow } from "./entities/answers.entity";
import { cbtPackages } from "./entities/packages.entity";
import type { CbtResultRow } from "./entities/results.entity";
import { cbtResults } from "./entities/results.entity";
import type {
  CbtSessionRow,
  CbtSessionStatus,
} from "./entities/sessions.entity";
import { cbtSessions } from "./entities/sessions.entity";

export interface CbtSessionFilters {
  packageId?: number;
  status?: CbtSessionStatus;
  search?: string;
}

export interface InsertCbtSessionRow {
  packageId: number;
  appUserId: number | null;
  participantName: string;
  createdBy: number;
}

export interface CbtSessionListItem extends CbtSessionRow {
  packageTitle: string;
}

export interface CbtResultListItem extends CbtResultRow {
  participantName: string;
  packageId: number;
  packageTitle: string;
  finishedAt: Date | null;
}

export interface InsertCbtResultRow {
  sessionId: number;
  twkScore: number;
  tiuScore: number;
  tkpScore: number;
  totalScore: number;
  passed: boolean;
}

export interface CbtPackageStatsRow {
  completed: number;
  passedCount: number;
  avgTotal: number | null;
  avgTwk: number | null;
  avgTiu: number | null;
  avgTkp: number | null;
  maxTotal: number | null;
  minTotal: number | null;
}

function toConditions(filters: CbtSessionFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.packageId !== undefined) {
    conditions.push(eq(cbtSessions.packageId, filters.packageId));
  }
  if (filters.status !== undefined) {
    conditions.push(eq(cbtSessions.status, filters.status));
  }
  const term = filters.search?.trim();
  if (term !== undefined && term !== "") {
    conditions.push(ilike(cbtSessions.participantName, `%${term}%`));
  }
  return conditions;
}

@Injectable()
export class CbtSessionsRepository {
  async list(
    db: Db,
    filters: CbtSessionFilters,
    pagination: { limit: number; offset: number },
  ): Promise<CbtSessionListItem[]> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db
      .select({
        session: cbtSessions,
        packageTitle: cbtPackages.title,
      })
      .from(cbtSessions)
      .innerJoin(cbtPackages, eq(cbtPackages.id, cbtSessions.packageId))
      .where(where)
      .orderBy(desc(cbtSessions.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset)
      .then((rows) =>
        rows.map((row) => ({ ...row.session, packageTitle: row.packageTitle })),
      );
  }

  async count(db: Db, filters: CbtSessionFilters): Promise<number> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(cbtSessions)
      .where(where);
    return rows[0]?.value ?? 0;
  }

  async findById(db: Db, id: number): Promise<CbtSessionRow | null> {
    const rows = await db
      .select()
      .from(cbtSessions)
      .where(eq(cbtSessions.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async insert(db: Db, row: InsertCbtSessionRow): Promise<CbtSessionRow> {
    const rows = await db.insert(cbtSessions).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal membuat sesi CBT.");
    }
    return created;
  }

  async markCompleted(db: Db, id: number, now: Date): Promise<CbtSessionRow> {
    const rows = await db
      .update(cbtSessions)
      .set({ status: "completed", finishedAt: now, updatedAt: now })
      .where(eq(cbtSessions.id, id))
      .returning();
    const updated = rows[0];
    if (!updated) {
      throw new Error("Gagal menyelesaikan sesi CBT.");
    }
    return updated;
  }

  async listAnswers(db: Db, sessionId: number): Promise<CbtAnswerRow[]> {
    return db
      .select()
      .from(cbtAnswers)
      .where(eq(cbtAnswers.sessionId, sessionId));
  }

  /** Upsert jawaban: satu baris per (sesi, soal), pilihan terakhir menang. */
  async upsertAnswers(
    db: Db,
    sessionId: number,
    answers: { questionId: number; selectedOption: "A" | "B" | "C" | "D" | "E" | null }[],
  ): Promise<void> {
    if (answers.length === 0) {
      return;
    }
    const now = new Date();
    await db
      .insert(cbtAnswers)
      .values(
        answers.map((answer) => ({
          sessionId,
          questionId: answer.questionId,
          selectedOption: answer.selectedOption,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [cbtAnswers.sessionId, cbtAnswers.questionId],
        set: { selectedOption: sql`excluded.selected_option`, updatedAt: now },
      });
  }

  async insertResult(db: Db, row: InsertCbtResultRow): Promise<CbtResultRow> {
    const rows = await db.insert(cbtResults).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal menyimpan hasil CBT.");
    }
    return created;
  }

  async findResultBySession(
    db: Db,
    sessionId: number,
  ): Promise<CbtResultRow | null> {
    const rows = await db
      .select()
      .from(cbtResults)
      .where(eq(cbtResults.sessionId, sessionId))
      .limit(1);
    return rows[0] ?? null;
  }

  async listResults(
    db: Db,
    filters: { packageId?: number; passed?: boolean },
    pagination: { limit: number; offset: number },
  ): Promise<CbtResultListItem[]> {
    const conditions: SQL[] = [];
    if (filters.packageId !== undefined) {
      conditions.push(eq(cbtSessions.packageId, filters.packageId));
    }
    if (filters.passed !== undefined) {
      conditions.push(eq(cbtResults.passed, filters.passed));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db
      .select({
        result: cbtResults,
        participantName: cbtSessions.participantName,
        packageId: cbtSessions.packageId,
        packageTitle: cbtPackages.title,
        finishedAt: cbtSessions.finishedAt,
      })
      .from(cbtResults)
      .innerJoin(cbtSessions, eq(cbtSessions.id, cbtResults.sessionId))
      .innerJoin(cbtPackages, eq(cbtPackages.id, cbtSessions.packageId))
      .where(where)
      .orderBy(desc(cbtResults.computedAt))
      .limit(pagination.limit)
      .offset(pagination.offset)
      .then((rows) =>
        rows.map((row) => ({
          ...row.result,
          participantName: row.participantName,
          packageId: row.packageId,
          packageTitle: row.packageTitle,
          finishedAt: row.finishedAt,
        })),
      );
  }

  async countResults(
    db: Db,
    filters: { packageId?: number; passed?: boolean },
  ): Promise<number> {
    const conditions: SQL[] = [];
    if (filters.packageId !== undefined) {
      conditions.push(eq(cbtSessions.packageId, filters.packageId));
    }
    if (filters.passed !== undefined) {
      conditions.push(eq(cbtResults.passed, filters.passed));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(cbtResults)
      .innerJoin(cbtSessions, eq(cbtSessions.id, cbtResults.sessionId))
      .where(where);
    return rows[0]?.value ?? 0;
  }

  /** Agregat analitik satu paket (rata-rata, lulus, tertinggi/terendah). */
  async statsByPackage(db: Db, packageId: number): Promise<CbtPackageStatsRow> {
    const rows = await db
      .select({
        completed: sql<number>`count(*)`.mapWith(Number),
        passedCount:
          sql<number>`count(*) filter (where ${cbtResults.passed})`.mapWith(Number),
        avgTotal: sql<number | null>`avg(${cbtResults.totalScore})`.mapWith(Number),
        avgTwk: sql<number | null>`avg(${cbtResults.twkScore})`.mapWith(Number),
        avgTiu: sql<number | null>`avg(${cbtResults.tiuScore})`.mapWith(Number),
        avgTkp: sql<number | null>`avg(${cbtResults.tkpScore})`.mapWith(Number),
        maxTotal: sql<number | null>`max(${cbtResults.totalScore})`.mapWith(Number),
        minTotal: sql<number | null>`min(${cbtResults.totalScore})`.mapWith(Number),
      })
      .from(cbtResults)
      .innerJoin(cbtSessions, eq(cbtSessions.id, cbtResults.sessionId))
      .where(eq(cbtSessions.packageId, packageId));
    const row = rows[0];
    return {
      completed: row?.completed ?? 0,
      passedCount: row?.passedCount ?? 0,
      avgTotal: row?.avgTotal ?? null,
      avgTwk: row?.avgTwk ?? null,
      avgTiu: row?.avgTiu ?? null,
      avgTkp: row?.avgTkp ?? null,
      maxTotal: row?.maxTotal ?? null,
      minTotal: row?.minTotal ?? null,
    };
  }
}
