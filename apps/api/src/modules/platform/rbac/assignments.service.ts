import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../../database/database.service";
import { AssignmentsRepository } from "./assignments.repository";
import { RbacService } from "./rbac.service";
import type { RoleDetail } from "./roles.service";
import { RolesService } from "./roles.service";

export interface AssignmentInput {
  adminId: string;
  roleId: string;
  appId?: string;
}

export interface AssignmentResult {
  adminId: string;
  roleId: string;
  roleName: string;
  appId: string | null;
}

export interface RoleAssignmentDetail {
  roleId: string;
  roleName: string;
  scopeType: "global" | "app";
  appId: string | null;
  appSlug: string | null;
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly assignments: AssignmentsRepository,
    private readonly roles: RolesService,
    private readonly rbac: RbacService,
  ) {}

  async assign(input: AssignmentInput): Promise<AssignmentResult> {
    const db = this.database.getControlPlaneConnection();
    const adminId = this.parseId(input.adminId);
    const role = await this.roles.findById(input.roleId);
    const appId = this.resolveAppId(role, input.appId);
    const roleId = Number(role.id);
    const exists = await this.assignments.exists(db, {
      adminId,
      roleId,
      appId,
    });
    if (exists) {
      throw new ConflictException("Penetapan role ini sudah ada.");
    }
    try {
      await this.assignments.insert(db, { adminId, roleId, appId });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException("Penetapan role ini sudah ada.");
      }
      if (this.isForeignKeyViolation(error)) {
        throw new BadRequestException("Admin atau role tidak ditemukan.");
      }
      throw error;
    }
    await this.rbac.bumpAdminVersion([input.adminId]);
    return {
      adminId: input.adminId,
      roleId: role.id,
      roleName: role.name,
      appId: appId === null ? null : String(appId),
    };
  }

  async unassign(input: AssignmentInput): Promise<AssignmentResult> {
    const db = this.database.getControlPlaneConnection();
    const adminId = this.parseId(input.adminId);
    const role = await this.roles.findById(input.roleId);
    const appId = this.resolveAppId(role, input.appId);
    const deleted = await this.assignments.delete(db, {
      adminId,
      roleId: Number(role.id),
      appId,
    });
    if (!deleted) {
      throw new NotFoundException("Penetapan tidak ditemukan.");
    }
    await this.rbac.bumpAdminVersion([input.adminId]);
    return {
      adminId: input.adminId,
      roleId: role.id,
      roleName: role.name,
      appId: appId === null ? null : String(appId),
    };
  }

  async listDetailedByAdmin(adminId: string): Promise<RoleAssignmentDetail[]> {
    const db = this.database.getControlPlaneConnection();
    const rows = await this.assignments.listDetailedByAdmin(
      db,
      this.parseId(adminId),
    );
    return rows.map((row) => ({
      roleId: String(row.roleId),
      roleName: row.roleName,
      scopeType: row.scopeType,
      appId: row.appId === null ? null : String(row.appId),
      appSlug: row.appSlug,
    }));
  }

  private resolveAppId(
    role: RoleDetail,
    appId?: string,
  ): number | null {
    if (role.scopeType === "global") {
      if (appId !== undefined) {
        throw new BadRequestException("Role global tidak memakai aplikasi.");
      }
      return null;
    }
    if (appId === undefined) {
      throw new BadRequestException(
        "Penetapan role aplikasi wajib menyebut aplikasi.",
      );
    }
    const numeric = this.parseId(appId);
    if (role.appId === null || Number(role.appId) !== numeric) {
      throw new BadRequestException(
        "Aplikasi penetapan harus sama dengan aplikasi role.",
      );
    }
    return numeric;
  }

  private parseId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }

  private isUniqueViolation(error: unknown): boolean {
    return this.pgCode(error) === "23505";
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return this.pgCode(error) === "23503";
  }

  private pgCode(error: unknown): string | null {
    if (typeof error !== "object" || error === null || !("code" in error)) {
      return null;
    }
    const code: unknown = error.code;
    return typeof code === "string" ? code : null;
  }
}
