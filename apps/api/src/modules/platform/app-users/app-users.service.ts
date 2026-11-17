import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Db } from "../../../database/database.service";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import type { AppUserRow } from "./app-users.entity";
import type {
  AppUserFilters,
  InsertAppUserRow,
  UpdateAppUserRow,
} from "./app-users.repository";
import { AppUsersRepository } from "./app-users.repository";
import type {
  AppUserStatus,
  CreateAppUserInput,
  UpdateAppUserInput,
} from "./dto/app-user.input";

export interface AppUserFilterInput {
  search?: string;
  status?: AppUserStatus;
}

export interface ListAppUsersInput {
  filter?: AppUserFilterInput;
  page?: number;
  perPage?: number;
}

export interface AppUserAuditContext {
  adminId: string;
  appId: string;
  ip: string | null;
}

export interface AppUserItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  metadata: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

function toItem(row: AppUserRow): AppUserItem {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatarUrl,
    isActive: row.isActive,
    metadata: row.metadata === null ? null : JSON.stringify(row.metadata),
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalize(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

@Injectable()
export class AppUsersService {
  constructor(
    private readonly users: AppUsersRepository,
    private readonly activityLog: ActivityLogService,
  ) {}

  async list(
    input: ListAppUsersInput,
    db: Db,
  ): Promise<{ items: AppUserItem[]; total: number }> {
    const page =
      input.page !== undefined &&
      Number.isInteger(input.page) &&
      input.page > 0
        ? input.page
        : DEFAULT_PAGE;
    const perPage =
      input.perPage !== undefined &&
      Number.isInteger(input.perPage) &&
      input.perPage > 0
        ? Math.min(input.perPage, MAX_PER_PAGE)
        : DEFAULT_PER_PAGE;
    const filters = this.toFilters(input.filter ?? {});
    const [rows, total] = await Promise.all([
      this.users.list(db, filters, {
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      this.users.count(db, filters),
    ]);
    return { items: rows.map(toItem), total };
  }

  async create(
    input: CreateAppUserInput,
    db: Db,
    audit: AppUserAuditContext,
  ): Promise<AppUserItem> {
    const email = normalize(input.email);
    const phone = normalize(input.phone);
    this.requireContact(email, phone);
    const row: InsertAppUserRow = {
      name: input.name.trim(),
      email,
      phone,
      avatarUrl: normalize(input.avatarUrl),
      metadata: this.parseMetadata(input.metadata),
    };
    await this.rejectDuplicates(db, email, phone);
    const created = await this.users.insert(db, row);
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "create",
      entityType: "app_user",
      entityId: String(created.id),
      summary: `Menambah user aplikasi ${created.name}`,
      ip: audit.ip,
    });
    return toItem(created);
  }

  async update(
    id: string,
    input: UpdateAppUserInput,
    db: Db,
    audit: AppUserAuditContext,
  ): Promise<AppUserItem> {
    const numericId = this.parseId(id);
    const existing = await this.mustFind(db, numericId);
    const email =
      input.email === undefined ? existing.email : normalize(input.email);
    const phone =
      input.phone === undefined ? existing.phone : normalize(input.phone);
    this.requireContact(email, phone);
    await this.rejectDuplicates(db, email, phone, numericId);
    const patch: UpdateAppUserRow = { updatedAt: new Date() };
    if (input.name !== undefined) {
      patch.name = input.name.trim();
    }
    if (input.email !== undefined) {
      patch.email = email;
    }
    if (input.phone !== undefined) {
      patch.phone = phone;
    }
    if (input.avatarUrl !== undefined) {
      patch.avatarUrl = normalize(input.avatarUrl);
    }
    if (input.metadata !== undefined) {
      patch.metadata =
        input.metadata === null ? null : this.parseMetadata(input.metadata);
    }
    const updated = await this.users.update(db, numericId, patch);
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "update",
      entityType: "app_user",
      entityId: String(updated.id),
      summary: `Mengubah user aplikasi ${updated.name}`,
      ip: audit.ip,
    });
    return toItem(updated);
  }

  async setActive(
    id: string,
    active: boolean,
    db: Db,
    audit: AppUserAuditContext,
  ): Promise<AppUserItem> {
    const numericId = this.parseId(id);
    await this.mustFind(db, numericId);
    const updated = await this.users.update(db, numericId, {
      isActive: active,
      updatedAt: new Date(),
    });
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: active ? "update" : "deactivate",
      entityType: "app_user",
      entityId: String(updated.id),
      summary: active
        ? `Mengaktifkan user aplikasi ${updated.name}`
        : `Menonaktifkan user aplikasi ${updated.name}`,
      ip: audit.ip,
    });
    return toItem(updated);
  }

  private toFilters(filter: AppUserFilterInput): AppUserFilters {
    const filters: AppUserFilters = {};
    if (filter.search !== undefined) {
      filters.search = filter.search;
    }
    if (filter.status !== undefined) {
      filters.status = filter.status;
    }
    return filters;
  }

  private parseId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }

  private async mustFind(db: Db, numericId: number): Promise<AppUserRow> {
    const existing = await this.users.findById(db, numericId);
    if (!existing) {
      throw new NotFoundException("User aplikasi tidak ditemukan.");
    }
    return existing;
  }

  /**
   * Minimal salah satu kontak wajib ada. Dicek di service (bukan
   * validator DTO) karena update perlu nilai efektif gabungan baris
   * lama + patch, yang hanya tersedia di sini.
   */
  private requireContact(
    email: string | null,
    phone: string | null,
  ): void {
    if (email === null && phone === null) {
      throw new BadRequestException(
        "Minimal salah satu dari email atau nomor telepon wajib diisi.",
      );
    }
  }

  private async rejectDuplicates(
    db: Db,
    email: string | null,
    phone: string | null,
    ignoreId?: number,
  ): Promise<void> {
    if (
      email !== null &&
      (await this.users.emailExists(db, email, ignoreId))
    ) {
      throw new ConflictException("Email sudah dipakai user lain.");
    }
    if (
      phone !== null &&
      (await this.users.phoneExists(db, phone, ignoreId))
    ) {
      throw new ConflictException("Nomor telepon sudah dipakai user lain.");
    }
  }

  private parseMetadata(
    value: string | null | undefined,
  ): Record<string, unknown> | null {
    const text = normalize(value);
    if (text === null) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("bukan objek");
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        "Metadata harus berupa JSON object yang valid.",
      );
    }
  }
}
