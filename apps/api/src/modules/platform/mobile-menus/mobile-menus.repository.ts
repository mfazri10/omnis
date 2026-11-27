import { and, eq } from "drizzle-orm";
import { Injectable } from "@nestjs/common";
import type { Db } from "../../../database/database.service";
import { apps } from "../entities/apps.entity";
import { menus } from "../entities/mobile-menus.entity";
import type { MobileMenuRow } from "../entities/mobile-menus.entity";

export type MobileMenuDb = Pick<Db, "select" | "insert" | "update" | "delete">;

export interface CreateMobileMenuRow {
  appId: number;
  name: string;
  slug: string;
  routeKey: string | null;
  iconKey: string | null;
  parentId: number | null;
  orderNo: number;
  isActive: boolean;
}

export interface UpdateMobileMenuRow {
  name?: string;
  slug?: string;
  routeKey?: string | null;
  iconKey?: string | null;
  parentId?: number | null;
  orderNo?: number;
  isActive?: boolean;
}

@Injectable()
export class MobileMenusRepository {
  async withAppLock<T>(
    db: Db,
    appId: number,
    operation: (transaction: MobileMenuDb) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (transaction) => {
      await transaction
        .select({ id: apps.id })
        .from(apps)
        .where(eq(apps.id, appId))
        .for("update");
      return operation(transaction);
    });
  }

  async listByAppId(db: MobileMenuDb, appId: number): Promise<MobileMenuRow[]> {
    return db
      .select()
      .from(menus)
      .where(eq(menus.appId, appId))
      .orderBy(menus.orderNo, menus.id);
  }

  async findByAppIdAndId(
    db: MobileMenuDb,
    appId: number,
    id: number,
  ): Promise<MobileMenuRow | null> {
    const rows = await db
      .select()
      .from(menus)
      .where(and(eq(menus.appId, appId), eq(menus.id, id)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByAppIdAndSlug(
    db: MobileMenuDb,
    appId: number,
    slug: string,
  ): Promise<MobileMenuRow | null> {
    const rows = await db
      .select()
      .from(menus)
      .where(and(eq(menus.appId, appId), eq(menus.slug, slug)))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByParentId(
    db: MobileMenuDb,
    appId: number,
    parentId: number,
  ): Promise<MobileMenuRow[]> {
    return db
      .select()
      .from(menus)
      .where(and(eq(menus.appId, appId), eq(menus.parentId, parentId)))
      .orderBy(menus.orderNo, menus.id);
  }

  async insert(db: MobileMenuDb, row: CreateMobileMenuRow): Promise<MobileMenuRow> {
    const rows = await db.insert(menus).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal membuat menu mobile.");
    }
    return created;
  }

  async updateByAppIdAndId(
    db: MobileMenuDb,
    appId: number,
    id: number,
    patch: UpdateMobileMenuRow,
  ): Promise<MobileMenuRow | null> {
    const rows = await db
      .update(menus)
      .set(patch)
      .where(and(eq(menus.appId, appId), eq(menus.id, id)))
      .returning();
    return rows[0] ?? null;
  }

  async deleteByAppIdAndId(
    db: MobileMenuDb,
    appId: number,
    id: number,
  ): Promise<void> {
    await db
      .delete(menus)
      .where(and(eq(menus.appId, appId), eq(menus.id, id)));
  }
}
