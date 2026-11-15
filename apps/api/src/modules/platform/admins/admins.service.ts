import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SessionRepository } from "../../../auth/session.repository";
import { DatabaseService } from "../../../database/database.service";
import { RbacService } from "../rbac/rbac.service";
import { AdminsRepository } from "./admins.repository";
import type { CreateProfileInput } from "./admins.repository";
import type { AdminRow } from "../entities/admins.entity";

export interface AdminProfile {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
}

export interface AdminListItem extends AdminProfile {
  isActive: boolean;
}

function toProfile(row: AdminRow): AdminProfile {
  return {
    id: String(row.id),
    authUserId: row.authUserId,
    name: row.name,
    email: row.email,
    isSuperAdmin: row.isSuperAdmin,
  };
}

function toListItem(row: AdminRow): AdminListItem {
  return { ...toProfile(row), isActive: row.isActive };
}

@Injectable()
export class AdminsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly admins: AdminsRepository,
    private readonly sessions: SessionRepository,
    private readonly rbac: RbacService,
  ) {}

  async findActiveByAuthUserId(
    authUserId: string,
  ): Promise<AdminProfile | null> {
    const row = await this.admins.findByAuthUserId(
      this.database.getControlPlaneConnection(),
      authUserId,
    );
    if (!row || !row.isActive) {
      return null;
    }
    return toProfile(row);
  }

  async findByEmail(email: string): Promise<AdminProfile | null> {
    const row = await this.admins.findByEmail(
      this.database.getControlPlaneConnection(),
      email,
    );
    return row ? toProfile(row) : null;
  }

  async createProfile(input: CreateProfileInput): Promise<AdminProfile> {
    const row = await this.admins.createProfile(
      this.database.getControlPlaneConnection(),
      input,
    );
    return toProfile(row);
  }

  async listAdmins(query: {
    search?: string;
    skip: number;
    take: number;
  }): Promise<{ items: AdminListItem[]; totalCount: number }> {
    const { rows, total } = await this.admins.list(
      this.database.getControlPlaneConnection(),
      query,
    );
    return { items: rows.map(toListItem), totalCount: total };
  }

  async updateAdmin(
    id: string,
    patch: { name: string },
  ): Promise<AdminListItem> {
    const db = this.database.getControlPlaneConnection();
    const numericId = this.parseId(id);
    const existing = await this.admins.findById(db, numericId);
    if (!existing) {
      throw new NotFoundException("Admin tidak ditemukan.");
    }
    await this.admins.updateName(db, numericId, patch.name);
    return toListItem({ ...existing, name: patch.name });
  }

  async findById(id: string): Promise<AdminListItem> {
    const db = this.database.getControlPlaneConnection();
    const row = await this.admins.findById(db, this.parseId(id));
    if (!row) {
      throw new NotFoundException("Admin tidak ditemukan.");
    }
    return toListItem(row);
  }

  async setAdminActive(id: string, active: boolean): Promise<AdminListItem> {
    const db = this.database.getControlPlaneConnection();
    const numericId = this.parseId(id);
    const existing = await this.admins.findById(db, numericId);
    if (!existing) {
      throw new NotFoundException("Admin tidak ditemukan.");
    }
    if (!active && existing.isSuperAdmin) {
      const supers = await this.admins.countActiveSuperAdmins(db);
      if (supers <= 1) {
        throw new ForbiddenException(
          "Tidak dapat menonaktifkan Super Admin aktif terakhir.",
        );
      }
    }
    await this.admins.setActive(db, numericId, active);
    if (!active) {
      await this.sessions.deleteByUserId(db, existing.authUserId);
      await this.rbac.bumpAdminVersion([String(existing.id)]);
    }
    return toListItem({ ...existing, isActive: active });
  }

  private parseId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }
}
