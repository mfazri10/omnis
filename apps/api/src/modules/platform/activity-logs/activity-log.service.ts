import { BadRequestException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../database/database.service";
import type {
  ActivityLogFilters,
  ActivityLogListItem,
} from "./activity-logs.repository";
import { ActivityLogsRepository } from "./activity-logs.repository";

export interface RecordActivityLogInput {
  adminId: string;
  appId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  ip?: string | null;
}

export interface ActivityLogFilterInput {
  dateFrom?: Date;
  dateTo?: Date;
  appId?: string;
  adminId?: string;
  entityType?: string;
  action?: string;
  search?: string;
}

export interface ListActivityLogsInput {
  filter?: ActivityLogFilterInput;
  page?: number;
  perPage?: number;
}

export interface ActivityLogItem {
  id: string;
  adminId: string;
  adminName: string | null;
  appId: string | null;
  appName: string | null;
  appSlug: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  ipAddress: string | null;
  createdAt: Date;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

function toItem(row: ActivityLogListItem): ActivityLogItem {
  return {
    id: String(row.id),
    adminId: String(row.adminId),
    adminName: row.adminName,
    appId: row.appId === null ? null : String(row.appId),
    appName: row.appName,
    appSlug: row.appSlug,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
  };
}

function parseIdOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

/**
 * Satu-satunya jalur tulis audit log (F06, append-only: tanpa ubah/hapus).
 * `record` tidak pernah melempar — kegagalan pencatatan hanya di-log
 * agar mutation utama tidak ikut gagal.
 */
@Injectable()
export class ActivityLogService {
  constructor(
    private readonly database: DatabaseService,
    private readonly logs: ActivityLogsRepository,
  ) {}

  async record(input: RecordActivityLogInput): Promise<void> {
    try {
      const adminId = parseIdOrNull(input.adminId);
      if (adminId === null) {
        console.error(
          `Gagal mencatat audit log: adminId tak valid (${input.adminId}).`,
        );
        return;
      }
      const appId = parseIdOrNull(input.appId);
      if (input.appId !== null && input.appId !== undefined && appId === null) {
        console.error(
          `Gagal mencatat audit log: appId tak valid (${input.appId}).`,
        );
        return;
      }
      await this.logs.insert(this.database.getControlPlaneConnection(), {
        adminId,
        appId,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary,
        ipAddress: input.ip ?? null,
      });
    } catch (error: unknown) {
      console.error("Gagal mencatat audit log:", error);
    }
  }

  async list(
    input: ListActivityLogsInput,
  ): Promise<{ items: ActivityLogItem[]; total: number }> {
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
    const db = this.database.getControlPlaneConnection();
    const [rows, total] = await Promise.all([
      this.logs.list(db, filters, {
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      this.logs.count(db, filters),
    ]);
    return { items: rows.map(toItem), total };
  }

  private toFilters(filter: ActivityLogFilterInput): ActivityLogFilters {
    const filters: ActivityLogFilters = {};
    if (filter.dateFrom !== undefined) {
      filters.dateFrom = filter.dateFrom;
    }
    if (filter.dateTo !== undefined) {
      filters.dateTo = filter.dateTo;
    }
    if (filter.appId !== undefined) {
      filters.appId = this.parseFilterId(filter.appId);
    }
    if (filter.adminId !== undefined) {
      filters.adminId = this.parseFilterId(filter.adminId);
    }
    if (filter.entityType !== undefined) {
      filters.entityType = filter.entityType;
    }
    if (filter.action !== undefined) {
      filters.action = filter.action;
    }
    if (filter.search !== undefined) {
      filters.search = filter.search;
    }
    return filters;
  }

  private parseFilterId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }
}
