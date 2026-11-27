import { and, eq } from "drizzle-orm";
import { Injectable } from "@nestjs/common";
import type { Db } from "../../../database/database.service";
import { menus } from "../entities/mobile-menus.entity";
import type { MobileMenuRow } from "../entities/mobile-menus.entity";

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
  async listByAppId(db: Db, appId: number): Promise<MobileMenuRow[]> {
    return db
      .select()
      .from(menus)
      .where(eq(menus.appId, appId))
      .orderBy(menus.orderNo, menus.id);
  }

  async findByAppIdAndId(
    db: Db,
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
    db: Db,
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
    db: Db,
    appId: number,
    parentId: number,
  ): Promise<MobileMenuRow[]> {
    return db
      .select()
      .from(menus)
      .where(and(eq(menus.appId, appId), eq(menus.parentId, parentId)))
      .orderBy(menus.orderNo, menus.id);
  }

  async insert(db: Db, row: CreateMobileMenuRow): Promise<MobileMenuRow> {
    const rows = await db.insert(menus).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal membuat menu mobile.");
    }
    return created;
  }

  async updateByAppIdAndId(
    db: Db,
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
    db: Db,
    appId: number,
    id: number,
  ): Promise<void> {
    await db
      .delete(menus)
      .where(and(eq(menus.appId, appId), eq(menus.id, id)));
  }
}
