import { Injectable } from "@nestjs/common";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { media } from "./media.entity";
import type { MediaRow } from "./media.entity";

export interface MediaFilters {
  search?: string;
}

export interface InsertMediaRow {
  uploadedByAdminId: number | null;
  fileName: string;
  path: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
}

function toConditions(filters: MediaFilters): SQL[] {
  const conditions: SQL[] = [];
  const term = filters.search?.trim();
  if (term !== undefined && term !== "") {
    const like = `%${term}%`;
    conditions.push(
      or(
        ilike(media.fileName, like),
        ilike(media.altText, like),
      ) as SQL,
    );
  }
  return conditions;
}

@Injectable()
export class MediaRepository {
  async list(
    db: Db,
    filters: MediaFilters,
    pagination: { limit: number; offset: number },
  ): Promise<MediaRow[]> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db
      .select()
      .from(media)
      .where(where)
      .orderBy(desc(media.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
  }

  async count(db: Db, filters: MediaFilters): Promise<number> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(media)
      .where(where);
    return rows[0]?.value ?? 0;
  }

  async findById(db: Db, id: number): Promise<MediaRow | null> {
    const rows = await db
      .select()
      .from(media)
      .where(eq(media.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async insert(db: Db, row: InsertMediaRow): Promise<MediaRow> {
    const rows = await db.insert(media).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal menyimpan metadata media.");
    }
    return created;
  }

  async delete(db: Db, id: number): Promise<void> {
    await db.delete(media).where(eq(media.id, id));
  }
}
