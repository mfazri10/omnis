import { Injectable } from "@nestjs/common";
import { and, count, eq, ilike, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { admins } from "../entities/admins.entity";
import type { AdminRow } from "../entities/admins.entity";

export interface CreateProfileInput {
  authUserId: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
}

@Injectable()
export class AdminsRepository {
  async findByAuthUserId(
    db: Db,
    authUserId: string,
  ): Promise<AdminRow | null> {
    const rows = await db
      .select()
      .from(admins)
      .where(eq(admins.authUserId, authUserId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByEmail(db: Db, email: string): Promise<AdminRow | null> {
    const rows = await db
      .select()
      .from(admins)
      .where(eq(admins.email, email))
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(db: Db, id: number): Promise<AdminRow | null> {
    const rows = await db
      .select()
      .from(admins)
      .where(eq(admins.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(
    db: Db,
    query: { search?: string; skip: number; take: number },
  ): Promise<{ rows: AdminRow[]; total: number }> {
    const term = query.search?.trim();
    const where: SQL | undefined =
      term === undefined || term === ""
        ? undefined
        : or(
            ilike(admins.name, `%${term}%`),
            ilike(admins.email, `%${term}%`),
          );
    const rows = await db
      .select()
      .from(admins)
      .where(where)
      .orderBy(admins.id)
      .limit(query.take)
      .offset(query.skip);
    const totalRows = await db
      .select({ value: count() })
      .from(admins)
      .where(where);
    return { rows, total: totalRows[0]?.value ?? 0 };
  }

  async updateName(db: Db, id: number, name: string): Promise<void> {
    await db.update(admins).set({ name }).where(eq(admins.id, id));
  }

  async setActive(db: Db, id: number, active: boolean): Promise<void> {
    await db
      .update(admins)
      .set({ isActive: active })
      .where(eq(admins.id, id));
  }

  async countActiveSuperAdmins(db: Db): Promise<number> {
    const rows = await db
      .select({ value: count() })
      .from(admins)
      .where(and(eq(admins.isSuperAdmin, true), eq(admins.isActive, true)));
    return rows[0]?.value ?? 0;
  }

  async createProfile(db: Db, input: CreateProfileInput): Promise<AdminRow> {
    const rows = await db
      .insert(admins)
      .values({
        authUserId: input.authUserId,
        name: input.name,
        email: input.email,
        isSuperAdmin: input.isSuperAdmin,
      })
      .returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal membuat profil admin.");
    }
    return created;
  }
}
