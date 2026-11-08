import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
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
