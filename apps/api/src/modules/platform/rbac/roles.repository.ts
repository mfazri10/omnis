import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { rolePermissions } from "../entities/role-assignments.entity";
import { permissions } from "../entities/permissions.entity";
import { roles } from "../entities/roles.entity";
import type { RoleRow } from "../entities/roles.entity";

export type RoleScope = "global" | "app";

export interface CreateRoleRow {
  name: string;
  description?: string;
  scopeType: RoleScope;
  appId: number | null;
}

export interface ListRolesFilter {
  scopeType?: RoleScope;
  appId?: number;
}

@Injectable()
export class RolesRepository {
  async insert(db: Db, input: CreateRoleRow): Promise<RoleRow> {
    const rows = await db
      .insert(roles)
      .values({
        name: input.name,
        description: input.description ?? null,
        scopeType: input.scopeType,
        appId: input.appId,
      })
      .returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal membuat role.");
    }
    return created;
  }

  async findById(db: Db, id: number): Promise<RoleRow | null> {
    const rows = await db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByNameInScope(
    db: Db,
    name: string,
    scopeType: RoleScope,
    appId: number | null,
  ): Promise<RoleRow | null> {
    const conditions = [eq(roles.name, name), eq(roles.scopeType, scopeType)];
    const rows = await db
      .select()
      .from(roles)
      .where(
        appId === null
          ? and(...conditions, isNull(roles.appId))
          : and(...conditions, eq(roles.appId, appId)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async list(db: Db, filter: ListRolesFilter): Promise<RoleRow[]> {
    const byScope =
      filter.scopeType === undefined
        ? undefined
        : eq(roles.scopeType, filter.scopeType);
    const byApp =
      filter.appId === undefined ? undefined : eq(roles.appId, filter.appId);
    if (byScope !== undefined && byApp !== undefined) {
      return db
        .select()
        .from(roles)
        .where(and(byScope, byApp));
    }
    const only = byScope ?? byApp;
    if (only === undefined) {
      return db.select().from(roles);
    }
    return db.select().from(roles).where(only);
  }

  async updateById(
    db: Db,
    id: number,
    patch: { name?: string; description?: string },
  ): Promise<void> {
    await db
      .update(roles)
      .set({ ...patch })
      .where(eq(roles.id, id));
  }

  async deleteById(db: Db, id: number): Promise<void> {
    await db.delete(roles).where(eq(roles.id, id));
  }

  async findRolePermissionKeys(db: Db, roleId: number): Promise<string[]> {
    const rows = await db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(
        permissions,
        eq(rolePermissions.permissionId, permissions.id),
      )
      .where(eq(rolePermissions.roleId, roleId));
    return rows.map((r) => r.key);
  }

  async replaceRolePermissions(
    db: Db,
    roleId: number,
    permissionIds: number[],
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));
      if (permissionIds.length > 0) {
        await tx.insert(rolePermissions).values(
          permissionIds.map((permissionId) => ({ roleId, permissionId })),
        );
      }
    });
  }
}
