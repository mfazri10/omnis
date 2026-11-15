import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { apps } from "../entities/apps.entity";
import { adminRoleAssignments } from "../entities/role-assignments.entity";
import { roles } from "../entities/roles.entity";

export interface AssignmentKey {
  adminId: number;
  roleId: number;
  appId: number | null;
}

export interface AssignmentRow {
  roleId: number;
  appId: number | null;
  scopeType: "global" | "app";
  roleAppId: number | null;
}

export interface DetailedAssignmentRow {
  roleId: number;
  roleName: string;
  scopeType: "global" | "app";
  appId: number | null;
  appSlug: string | null;
}

@Injectable()
export class AssignmentsRepository {
  async insert(db: Db, key: AssignmentKey): Promise<void> {
    await db.insert(adminRoleAssignments).values({
      adminId: key.adminId,
      roleId: key.roleId,
      appId: key.appId,
    });
  }

  async delete(db: Db, key: AssignmentKey): Promise<boolean> {
    const rows = await db
      .delete(adminRoleAssignments)
      .where(this.matchCondition(key))
      .returning({ id: adminRoleAssignments.id });
    return rows.length > 0;
  }

  async exists(db: Db, key: AssignmentKey): Promise<boolean> {
    const rows = await db
      .select({ id: adminRoleAssignments.id })
      .from(adminRoleAssignments)
      .where(this.matchCondition(key))
      .limit(1);
    return rows.length > 0;
  }

  async listAdminIdsByRole(db: Db, roleId: number): Promise<number[]> {
    const rows = await db
      .selectDistinct({ adminId: adminRoleAssignments.adminId })
      .from(adminRoleAssignments)
      .where(eq(adminRoleAssignments.roleId, roleId));
    return rows.map((r) => r.adminId);
  }

  async listByAdmin(db: Db, adminId: number): Promise<AssignmentRow[]> {
    return db
      .select({
        roleId: adminRoleAssignments.roleId,
        appId: adminRoleAssignments.appId,
        scopeType: roles.scopeType,
        roleAppId: roles.appId,
      })
      .from(adminRoleAssignments)
      .innerJoin(roles, eq(adminRoleAssignments.roleId, roles.id))
      .where(eq(adminRoleAssignments.adminId, adminId));
  }

  async listDetailedByAdmin(
    db: Db,
    adminId: number,
  ): Promise<DetailedAssignmentRow[]> {
    return db
      .select({
        roleId: adminRoleAssignments.roleId,
        roleName: roles.name,
        scopeType: roles.scopeType,
        appId: adminRoleAssignments.appId,
        appSlug: apps.slug,
      })
      .from(adminRoleAssignments)
      .innerJoin(roles, eq(adminRoleAssignments.roleId, roles.id))
      .leftJoin(apps, eq(adminRoleAssignments.appId, apps.id))
      .where(eq(adminRoleAssignments.adminId, adminId));
  }

  private matchCondition(key: AssignmentKey): SQL | undefined {
    const base = [
      eq(adminRoleAssignments.adminId, key.adminId),
      eq(adminRoleAssignments.roleId, key.roleId),
    ];
    return key.appId === null
      ? and(...base, isNull(adminRoleAssignments.appId))
      : and(...base, eq(adminRoleAssignments.appId, key.appId));
  }
}
