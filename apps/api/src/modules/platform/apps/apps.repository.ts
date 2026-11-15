import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { apps } from "../entities/apps.entity";
import type { AppRow } from "../entities/apps.entity";

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
}
