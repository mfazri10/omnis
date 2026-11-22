import type { Db } from "../../../database/database.service";
import { BadRequestException } from "@nestjs/common";
import {
  CBT_TABLES_MISSING_MESSAGE,
  isUndefinedTable,
} from "../../cbt/cbt-dashboard.section";
import type { AppUserRow } from "../app-users/app-users.entity";
import type { AppUserFilters } from "../app-users/app-users.repository";
import type { AppUsersRepository } from "../app-users/app-users.repository";
import type {
  ActivityLogFilters,
  ActivityLogListItem,
} from "../activity-logs/activity-logs.repository";
import type { ActivityLogsRepository } from "../activity-logs/activity-logs.repository";
import type {
  CbtResultListItem,
  CbtSessionsRepository,
} from "../../cbt/sessions.repository";
import type {
  ExportJobFilterJson,
  ExportSourceKey,
} from "../entities/export-jobs.entity";
import type { CsvCellValue } from "./csv";

export interface ExportColumn<Row> {
  header: string;
  pick: (row: Row) => CsvCellValue;
}

/**
 * Definisi satu sumber ekspor: filter identik dengan tampilan daftar
 * karena count/listBatch memakai ulang repository yang sama. Sumber
 * baru (mis. POS/CBT setelah F12) tinggal didaftarkan di sini.
 */
export interface ExportSourceDef<Row, RepoFilter> {
  key: ExportSourceKey;
  label: string;
  permission: string;
  appScoped: boolean;
  fileNamePrefix: string;
  columns: ExportColumn<Row>[];
  toJson: (filter: RepoFilter) => ExportJobFilterJson;
  fromJson: (json: ExportJobFilterJson) => RepoFilter;
  count: (db: Db, filter: RepoFilter) => Promise<number>;
  listBatch: (
    db: Db,
    filter: RepoFilter,
    page: { limit: number; offset: number },
  ) => Promise<Row[]>;
}

export interface ExportSourceRegistry {
  app_users: ExportSourceDef<AppUserRow, AppUserFilters>;
  activity_logs: ExportSourceDef<ActivityLogListItem, ActivityLogFilters>;
  cbt_results: ExportSourceDef<CbtResultListItem, CbtResultFilters>;
}

/** Filter hasil CBT: sama dengan daftar hasil di layar CMS. */
export interface CbtResultFilters {
  packageId?: number;
  passed?: boolean;
}

export interface ExportSourceRepos {
  appUsers: AppUsersRepository;
  activityLogs: ActivityLogsRepository;
  cbtSessions: CbtSessionsRepository;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function asDate(value: unknown): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asPositiveInt(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
    ? value
    : undefined;
}

function stripUndefined(
  record: Record<string, unknown>,
): ExportJobFilterJson {
  const json: ExportJobFilterJson = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      json[key] = value;
    }
  }
  return json;
}

/** Registry sumber ekspor generik, dibangun dari repository yang ada. */
export function createExportSources(
  repos: ExportSourceRepos,
): ExportSourceRegistry {
  return {
    app_users: {
      key: "app_users",
      label: "user aplikasi",
      permission: "platform.users.view",
      appScoped: true,
      fileNamePrefix: "user-aplikasi",
      columns: [
        { header: "id", pick: (row) => row.id },
        { header: "name", pick: (row) => row.name },
        { header: "email", pick: (row) => row.email },
        { header: "phone", pick: (row) => row.phone },
        { header: "isActive", pick: (row) => row.isActive ?? false },
        { header: "lastLoginAt", pick: (row) => row.lastLoginAt },
        { header: "createdAt", pick: (row) => row.createdAt },
        { header: "updatedAt", pick: (row) => row.updatedAt },
      ],
      toJson: (filter) =>
        stripUndefined({ search: filter.search, status: filter.status }),
      fromJson: (json) => {
        const filter: AppUserFilters = {};
        if (isNonEmptyString(json["search"])) {
          filter.search = json["search"];
        }
        if (json["status"] === "active" || json["status"] === "inactive") {
          filter.status = json["status"];
        }
        return filter;
      },
      count: (db, filter) => repos.appUsers.count(db, filter),
      listBatch: (db, filter, page) =>
        repos.appUsers.list(db, filter, page),
    },
    activity_logs: {
      key: "activity_logs",
      label: "log audit",
      permission: "platform.audit.view",
      appScoped: false,
      fileNamePrefix: "audit-log",
      columns: [
        { header: "id", pick: (row) => row.id },
        { header: "createdAt", pick: (row) => row.createdAt },
        { header: "adminName", pick: (row) => row.adminName },
        { header: "appName", pick: (row) => row.appName },
        { header: "appSlug", pick: (row) => row.appSlug },
        { header: "action", pick: (row) => row.action },
        { header: "entityType", pick: (row) => row.entityType },
        { header: "entityId", pick: (row) => row.entityId },
        { header: "summary", pick: (row) => row.summary },
        { header: "ipAddress", pick: (row) => row.ipAddress },
      ],
      toJson: (filter) =>
        stripUndefined({
          dateFrom: filter.dateFrom?.toISOString(),
          dateTo: filter.dateTo?.toISOString(),
          appId: filter.appId,
          adminId: filter.adminId,
          entityType: filter.entityType,
          action: filter.action,
          search: filter.search,
        }),
      fromJson: (json) => {
        const filter: ActivityLogFilters = {};
        const dateFrom = asDate(json["dateFrom"]);
        if (dateFrom) {
          filter.dateFrom = dateFrom;
        }
        const dateTo = asDate(json["dateTo"]);
        if (dateTo) {
          filter.dateTo = dateTo;
        }
        const appId = asPositiveInt(json["appId"]);
        if (appId !== undefined) {
          filter.appId = appId;
        }
        const adminId = asPositiveInt(json["adminId"]);
        if (adminId !== undefined) {
          filter.adminId = adminId;
        }
        if (isNonEmptyString(json["entityType"])) {
          filter.entityType = json["entityType"];
        }
        if (isNonEmptyString(json["action"])) {
          filter.action = json["action"];
        }
        if (isNonEmptyString(json["search"])) {
          filter.search = json["search"];
        }
        return filter;
      },
      count: (db, filter) => repos.activityLogs.count(db, filter),
      listBatch: (db, filter, page) =>
        repos.activityLogs.list(db, filter, page),
    },
    cbt_results: {
      key: "cbt_results",
      label: "hasil CBT",
      permission: "cbt.results.view",
      appScoped: true,
      fileNamePrefix: "hasil-cbt",
      columns: [
        { header: "id", pick: (row) => row.id },
        { header: "sessionId", pick: (row) => row.sessionId },
        { header: "participantName", pick: (row) => row.participantName },
        { header: "packageId", pick: (row) => row.packageId },
        { header: "packageTitle", pick: (row) => row.packageTitle },
        { header: "twkScore", pick: (row) => row.twkScore },
        { header: "tiuScore", pick: (row) => row.tiuScore },
        { header: "tkpScore", pick: (row) => row.tkpScore },
        { header: "totalScore", pick: (row) => row.totalScore },
        { header: "passed", pick: (row) => row.passed },
        { header: "computedAt", pick: (row) => row.computedAt },
        { header: "finishedAt", pick: (row) => row.finishedAt },
      ],
      toJson: (filter) =>
        stripUndefined({ packageId: filter.packageId, passed: filter.passed }),
      fromJson: (json) => {
        const filter: CbtResultFilters = {};
        const packageId = asPositiveInt(json["packageId"]);
        if (packageId !== undefined) {
          filter.packageId = packageId;
        }
        if (typeof json["passed"] === "boolean") {
          filter.passed = json["passed"];
        }
        return filter;
      },
      count: (db, filter) =>
        withCbtTables(db, () => repos.cbtSessions.countResults(db, filter)),
      listBatch: (db, filter, page) =>
        withCbtTables(db, () => repos.cbtSessions.listResults(db, filter, page)),
    },
  };
}

/**
 * Jalur ekspor tidak lewat resolver modul CBT, jadi interceptor 42P01
 * modul itu tidak berlaku di sini: sumber hasil CBT memetakan
 * `undefined_table` sendiri agar aplikasi tanpa modul dijawab pesan
 * yang sama, bukan INTERNAL_ERROR.
 */
async function withCbtTables<T>(
  _db: Db,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error: unknown) {
    if (isUndefinedTable(error)) {
      throw new BadRequestException(CBT_TABLES_MISSING_MESSAGE);
    }
    throw error;
  }
}

export function isExportSourceKey(value: string): value is ExportSourceKey {
  return (
    value === "app_users" ||
    value === "activity_logs" ||
    value === "cbt_results"
  );
}

/** Satu baris repository → sel CSV sesuai urutan kolom sumber. */
export function cellsOf<Row>(
  def: { columns: ExportColumn<Row>[] },
  row: Row,
): CsvCellValue[] {
  return def.columns.map((column) => column.pick(row));
}
