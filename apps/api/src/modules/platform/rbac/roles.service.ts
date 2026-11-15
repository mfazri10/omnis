import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../../database/database.service";
import { AppsRepository } from "../apps/apps.repository";
import type { RoleRow } from "../entities/roles.entity";
import type { Db } from "../../../database/database.service";
import { AssignmentsRepository } from "./assignments.repository";
import { PermissionsRepository } from "./permissions.repository";
import { isSensitivePermission } from "./platform.permissions";
import type { RoleScope } from "./roles.repository";
import { RolesRepository } from "./roles.repository";

export interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  scopeType: RoleScope;
  appId: string | null;
  permissionKeys: string[];
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  scopeType: RoleScope;
  appId?: string;
  permissionKeys: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissionKeys?: string[];
}

@Injectable()
export class RolesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly roles: RolesRepository,
    private readonly permissions: PermissionsRepository,
    private readonly apps: AppsRepository,
    private readonly assignments: AssignmentsRepository,
  ) {}

  async create(input: CreateRoleInput): Promise<RoleDetail> {
    const db = this.database.getControlPlaneConnection();
    const appId = await this.resolveAppId(db, input.scopeType, input.appId);
    const permissionIds = await this.resolveKeys(
      db,
      input.scopeType,
      input.permissionKeys,
    );
    const duplicate = await this.roles.findByNameInScope(
      db,
      input.name,
      input.scopeType,
      appId,
    );
    if (duplicate) {
      throw new ConflictException(
        "Nama role sudah dipakai dalam cakupan ini.",
      );
    }
    const created = await this.roles.insert(db, {
      name: input.name,
      description: input.description,
      scopeType: input.scopeType,
      appId,
    });
    await this.roles.replaceRolePermissions(db, created.id, permissionIds);
    return this.toDetail(db, created);
  }

  async update(id: string, patch: UpdateRoleInput): Promise<RoleDetail> {
    const db = this.database.getControlPlaneConnection();
    const numericId = this.parseId(id);
    const existing = await this.roles.findById(db, numericId);
    if (!existing) {
      throw new NotFoundException("Role tidak ditemukan.");
    }
    if (patch.name !== undefined && patch.name !== existing.name) {
      const duplicate = await this.roles.findByNameInScope(
        db,
        patch.name,
        existing.scopeType,
        existing.appId,
      );
      if (duplicate) {
        throw new ConflictException(
          "Nama role sudah dipakai dalam cakupan ini.",
        );
      }
    }
    if (patch.permissionKeys !== undefined) {
      const permissionIds = await this.resolveKeys(
        db,
        existing.scopeType,
        patch.permissionKeys,
      );
      await this.roles.replaceRolePermissions(db, numericId, permissionIds);
    }
    await this.roles.updateById(db, numericId, {
      name: patch.name,
      description: patch.description,
    });
    const updated = await this.roles.findById(db, numericId);
    if (!updated) {
      throw new NotFoundException("Role tidak ditemukan.");
    }
    return this.toDetail(db, updated);
  }

  async remove(id: string): Promise<void> {
    const db = this.database.getControlPlaneConnection();
    const numericId = this.parseId(id);
    const existing = await this.roles.findById(db, numericId);
    if (!existing) {
      throw new NotFoundException("Role tidak ditemukan.");
    }
    const adminIds = await this.assignments.listAdminIdsByRole(db, numericId);
    if (adminIds.length > 0) {
      throw new ConflictException(
        `Role masih dipakai ${adminIds.length} penetapan. Cabut dulu sebelum menghapus.`,
      );
    }
    await this.roles.replaceRolePermissions(db, numericId, []);
    await this.roles.deleteById(db, numericId);
  }

  async findById(id: string): Promise<RoleDetail> {
    const db = this.database.getControlPlaneConnection();
    const row = await this.roles.findById(db, this.parseId(id));
    if (!row) {
      throw new NotFoundException("Role tidak ditemukan.");
    }
    return this.toDetail(db, row);
  }

  async list(scopeType?: RoleScope, appId?: string): Promise<RoleDetail[]> {
    const db = this.database.getControlPlaneConnection();
    const rows = await this.roles.list(db, {
      scopeType,
      appId: appId === undefined ? undefined : this.parseId(appId),
    });
    const details: RoleDetail[] = [];
    for (const row of rows) {
      details.push(await this.toDetail(db, row));
    }
    return details;
  }

  private async resolveAppId(
    db: Db,
    scopeType: RoleScope,
    appId?: string,
  ): Promise<number | null> {
    if (scopeType === "global") {
      if (appId !== undefined) {
        throw new BadRequestException("Role global tidak memakai aplikasi.");
      }
      return null;
    }
    if (appId === undefined) {
      throw new BadRequestException("Role cakupan-app wajib memilih aplikasi.");
    }
    const numericId = this.parseId(appId);
    const app = await this.apps.findById(db, numericId);
    if (!app) {
      throw new BadRequestException("Aplikasi tidak ditemukan.");
    }
    if (app.status !== "active") {
      throw new BadRequestException("Aplikasi tidak aktif.");
    }
    return numericId;
  }

  private async resolveKeys(
    db: Db,
    scopeType: RoleScope,
    keys: string[],
  ): Promise<number[]> {
    const ids: number[] = [];
    for (const key of keys) {
      if (scopeType === "app" && isSensitivePermission(key)) {
        throw new BadRequestException(
          `Permission ${key} hanya untuk role global.`,
        );
      }
      const row = await this.permissions.findByKey(db, key);
      if (!row) {
        throw new BadRequestException(`Permission tidak dikenal: ${key}.`);
      }
      ids.push(row.id);
    }
    return ids;
  }

  private async toDetail(db: Db, row: RoleRow): Promise<RoleDetail> {
    const permissionKeys = await this.roles.findRolePermissionKeys(db, row.id);
    return {
      id: String(row.id),
      name: row.name,
      description: row.description,
      scopeType: row.scopeType,
      appId: row.appId === null ? null : String(row.appId),
      permissionKeys,
    };
  }

  private parseId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }
}
