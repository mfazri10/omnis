import { Injectable } from "@nestjs/common";
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import type { AppUserRow } from "./app-users.entity";
import { appUsers } from "./app-users.entity";

export type AppUserStatusFilter = "active" | "inactive";

export interface AppUserFilters {
  search?: string;
  status?: AppUserStatusFilter;
}

export interface InsertAppUserRow {
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  metadata: Record<string, unknown> | null;
}

export interface UpdateAppUserRow {
  name?: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  isActive?: boolean;
  updatedAt: Date;
}

function toConditions(filters: AppUserFilters): SQL[] {
  const conditions: SQL[] = [];
  const term = filters.search?.trim();
  if (term !== undefined && term !== "") {
    const like = `%${term}%`;
    conditions.push(
      or(
        ilike(appUsers.name, like),
        ilike(appUsers.email, like),
        ilike(appUsers.phone, like),
      ) as SQL,
    );
  }
  if (filters.status === "active") {
    conditions.push(eq(appUsers.isActive, true));
  }
  if (filters.status === "inactive") {
    conditions.push(eq(appUsers.isActive, false));
  }
  return conditions;
}

@Injectable()
export class AppUsersRepository {
  async list(
    db: Db,
    filters: AppUserFilters,
    pagination: { limit: number; offset: number },
  ): Promise<AppUserRow[]> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db
      .select()
      .from(appUsers)
      .where(where)
      .orderBy(desc(appUsers.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
  }

  async count(db: Db, filters: AppUserFilters): Promise<number> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(appUsers)
      .where(where);
    return rows[0]?.value ?? 0;
  }

  async findById(db: Db, id: number): Promise<AppUserRow | null> {
    const rows = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async insert(db: Db, row: InsertAppUserRow): Promise<AppUserRow> {
    const rows = await db.insert(appUsers).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal menambah user aplikasi.");
    }
    return created;
  }

  async update(
    db: Db,
    id: number,
    patch: UpdateAppUserRow,
  ): Promise<AppUserRow> {
    const rows = await db
      .update(appUsers)
      .set(patch)
      .where(eq(appUsers.id, id))
      .returning();
    const updated = rows[0];
    if (!updated) {
      throw new Error("Gagal mengubah user aplikasi.");
    }
    return updated;
  }

  async emailExists(
    db: Db,
    email: string,
    ignoreId?: number,
  ): Promise<boolean> {
    const conditions: SQL[] = [eq(appUsers.email, email)];
    if (ignoreId !== undefined) {
      conditions.push(ne(appUsers.id, ignoreId));
    }
    const rows = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(and(...conditions))
      .limit(1);
    return rows.length > 0;
  }

  async phoneExists(
    db: Db,
    phone: string,
    ignoreId?: number,
  ): Promise<boolean> {
    const conditions: SQL[] = [eq(appUsers.phone, phone)];
    if (ignoreId !== undefined) {
      conditions.push(ne(appUsers.id, ignoreId));
    }
    const rows = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(and(...conditions))
      .limit(1);
    return rows.length > 0;
  }
}
