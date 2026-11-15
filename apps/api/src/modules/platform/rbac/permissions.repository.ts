import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { permissions } from "../entities/permissions.entity";
import type { PermissionRow } from "../entities/permissions.entity";
import type { PermissionDef } from "./platform.permissions";

@Injectable()
export class PermissionsRepository {
  async findByKey(db: Db, key: string): Promise<PermissionRow | null> {
    const rows = await db
      .select()
      .from(permissions)
      .where(eq(permissions.key, key))
      .limit(1);
    return rows[0] ?? null;
  }

  async insert(db: Db, def: PermissionDef): Promise<PermissionRow> {
    const rows = await db
      .insert(permissions)
      .values({
        key: def.key,
        module: def.module,
        label: def.label,
        description: def.description ?? null,
      })
      .returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal menyimpan permission.");
    }
    return created;
  }

  async updateByKey(
    db: Db,
    key: string,
    patch: { module: string; label: string; description?: string },
  ): Promise<void> {
    await db
      .update(permissions)
      .set({
        module: patch.module,
        label: patch.label,
        description: patch.description ?? null,
      })
      .where(eq(permissions.key, key));
  }

  async listByModule(db: Db, module?: string): Promise<PermissionRow[]> {
    if (module === undefined) {
      return db.select().from(permissions);
    }
    return db.select().from(permissions).where(eq(permissions.module, module));
  }
}
