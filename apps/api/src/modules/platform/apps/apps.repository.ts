import { Injectable } from "@nestjs/common";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { apps } from "../entities/apps.entity";
import type { AppRow, AppStatus } from "../entities/apps.entity";

export interface CreateAppRow {
  name: string;
  slug: string;
  dbName: string;
  status: AppStatus;
  iconMediaUrl?: string | null;
  androidPackage?: string | null;
  iosBundleId?: string | null;
  storeUrlAndroid?: string | null;
  storeUrlIos?: string | null;
  notes?: string | null;
  failureReason?: string | null;
  lastProvisioningAt?: Date | null;
}

export interface UpdateAppRow {
  name?: string;
  iconMediaUrl?: string | null;
  androidPackage?: string | null;
  iosBundleId?: string | null;
  storeUrlAndroid?: string | null;
  storeUrlIos?: string | null;
  notes?: string | null;
  status?: AppStatus;
  failureReason?: string | null;
  lastProvisioningAt?: Date | null;
  fcmCredential?: string | null;
}

@Injectable()
export class AppsRepository {
  async findById(db: Db, id: number): Promise<AppRow | null> {
    const rows = await db
      .select()
      .from(apps)
      .where(eq(apps.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findBySlug(db: Db, slug: string): Promise<AppRow | null> {
    const rows = await db
      .select()
      .from(apps)
      .where(eq(apps.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  }

  async listActive(db: Db): Promise<AppRow[]> {
    return db.select().from(apps).where(eq(apps.status, "active"));
  }

  async insert(db: Db, row: CreateAppRow): Promise<AppRow> {
    const rows = await db.insert(apps).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal membuat baris aplikasi.");
    }
    return created;
  }

  async list(
    db: Db,
    filter: { statuses: AppStatus[] | null; search?: string },
  ): Promise<AppRow[]> {
    const term = filter.search?.trim();
    const byStatus: SQL | undefined =
      filter.statuses === null ? undefined : inArray(apps.status, filter.statuses);
    const bySearch: SQL | undefined =
      term === undefined || term === ""
        ? undefined
        : or(ilike(apps.name, `%${term}%`), ilike(apps.slug, `%${term}%`));
    if (byStatus !== undefined && bySearch !== undefined) {
      return db
        .select()
        .from(apps)
        .where(and(byStatus, bySearch))
        .orderBy(apps.name);
    }
    const only = byStatus ?? bySearch;
    if (only === undefined) {
      return db.select().from(apps).orderBy(apps.name);
    }
    return db.select().from(apps).where(only).orderBy(apps.name);
  }

  async updateById(db: Db, id: number, patch: UpdateAppRow): Promise<void> {
    await db.update(apps).set(patch).where(eq(apps.id, id));
  }

  async deleteById(db: Db, id: number): Promise<void> {
    await db.delete(apps).where(eq(apps.id, id));
  }
}
