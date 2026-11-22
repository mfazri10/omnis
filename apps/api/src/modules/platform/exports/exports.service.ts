import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "node:fs";
import {
  DatabaseService,
  type Db,
} from "../../../database/database.service";
import type { AdminProfile } from "../admins/admins.service";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import type { ActivityLogFilters } from "../activity-logs/activity-logs.repository";
import { ActivityLogsRepository } from "../activity-logs/activity-logs.repository";
import type { AppUserFilters } from "../app-users/app-users.repository";
import { AppUsersRepository } from "../app-users/app-users.repository";
import { AppsRepository } from "../apps/apps.repository";
import { CbtSessionsRepository } from "../../cbt/sessions.repository";
import type {
  ExportJobRow,
  ExportSourceKey,
} from "../entities/export-jobs.entity";
import { cellsOf, createExportSources } from "./export-sources";
import type {
  CbtResultFilters,
  ExportSourceDef,
  ExportSourceRegistry,
} from "./export-sources";
import { ExportFileStore } from "./export-file-store";
import { ExportsRepository } from "./exports.repository";
import { serializeCsv, type CsvCellValue } from "./csv";
import { ExportJobStatus, ExportSource } from "./types/export-job.type";

export interface AppUsersExportFilter {
  search?: string;
  status?: "active" | "inactive";
}

export interface ActivityLogsExportFilter {
  dateFrom?: Date;
  dateTo?: Date;
  appId?: string;
  adminId?: string;
  entityType?: string;
  action?: string;
  search?: string;
}

/** Filter ekspor hasil CBT (F12): sama dengan filter daftar hasil. */
export interface CbtResultsExportFilter {
  packageId?: string;
  passed?: boolean;
}

/** Konteks aplikasi tervalidasi guard untuk sumber app-scoped. */
export interface ExportRequestContext {
  appId: string;
  slug: string;
}

export interface ExportJobItem {
  id: string;
  source: ExportSource;
  status: ExportJobStatus;
  rowCount: number | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
  downloadPath: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportDownload {
  absolutePath: string;
  fileName: string;
  sizeBytes: number;
}

export type ExportExecuteOutcome = "done" | "failed" | "skipped";

const DEFAULT_MAX_ROWS = 50000;
const DEFAULT_TTL_HOURS = 24;
const BATCH_SIZE = 1000;
const MAX_LIST_LIMIT = 20;
const STALE_RUNNING_MINUTES = 10;

function toSourceEnum(source: string): ExportSource {
  if (source === "activity_logs") {
    return ExportSource.ACTIVITY_LOGS;
  }
  if (source === "cbt_results") {
    return ExportSource.CBT_RESULTS;
  }
  return ExportSource.APP_USERS;
}

function toStatusEnum(status: string): ExportJobStatus {
  switch (status) {
    case "running":
      return ExportJobStatus.RUNNING;
    case "done":
      return ExportJobStatus.DONE;
    case "failed":
      return ExportJobStatus.FAILED;
    case "expired":
      return ExportJobStatus.EXPIRED;
    default:
      return ExportJobStatus.QUEUED;
  }
}

function toItem(row: ExportJobRow): ExportJobItem {
  return {
    id: String(row.id),
    source: toSourceEnum(row.source),
    status: toStatusEnum(row.status),
    rowCount: row.rowCount,
    fileName: row.fileName,
    fileSizeBytes: row.fileSizeBytes,
    errorMessage: row.errorMessage,
    downloadPath:
      row.status === "done" ? `/exports/${row.id}/download` : null,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Stempel `yyyyMMdd-HHmmss` (UTC) untuk nama berkas hasil. */
function fileTimestamp(now: Date): string {
  return (
    `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}` +
    `-${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}`
  );
}

@Injectable()
export class ExportsService {
  private readonly sources: ExportSourceRegistry;
  private readonly maxRows: number;
  private readonly ttlHours: number;

  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
    private readonly jobs: ExportsRepository,
    appUsers: AppUsersRepository,
    activityLogs: ActivityLogsRepository,
    cbtSessions: CbtSessionsRepository,
    private readonly apps: AppsRepository,
    private readonly activityLog: ActivityLogService,
    private readonly store: ExportFileStore,
  ) {
    this.sources = createExportSources({ appUsers, activityLogs, cbtSessions });
    this.maxRows = positiveIntOf(
      this.config.get<number>("EXPORT_MAX_ROWS"),
      DEFAULT_MAX_ROWS,
    );
    this.ttlHours = positiveIntOf(
      this.config.get<number>("EXPORT_TTL_HOURS"),
      DEFAULT_TTL_HOURS,
    );
  }

  private controlDb(): Db {
    return this.database.getControlPlaneConnection();
  }

  async request(
    source: "app_users",
    filter: AppUsersExportFilter,
    admin: AdminProfile,
    ctx: ExportRequestContext,
    ip: string | null,
  ): Promise<ExportJobItem>;
  async request(
    source: "activity_logs",
    filter: ActivityLogsExportFilter,
    admin: AdminProfile,
    ctx: null,
    ip: string | null,
  ): Promise<ExportJobItem>;
  async request(
    source: "cbt_results",
    filter: CbtResultsExportFilter,
    admin: AdminProfile,
    ctx: ExportRequestContext,
    ip: string | null,
  ): Promise<ExportJobItem>;
  async request(
    source: ExportSourceKey,
    filter:
      | AppUsersExportFilter
      | ActivityLogsExportFilter
      | CbtResultsExportFilter,
    admin: AdminProfile,
    ctx: ExportRequestContext | null,
    ip: string | null,
  ): Promise<ExportJobItem> {
    const db = await this.sourceDb(source, ctx?.slug ?? null);
    const repoFilter = this.toRepoFilter(source, filter);
    const total = await this.countFor(source, db, repoFilter);
    if (total === 0) {
      throw new BadRequestException(
        "Tidak ada data yang cocok dengan filter. Ubah filter lalu coba lagi.",
      );
    }
    if (total > this.maxRows) {
      throw new BadRequestException(
        `Jumlah baris (${total}) melebihi batas ekspor (${this.maxRows}). Persempit filter lalu coba lagi.`,
      );
    }
    const active = await this.jobs.findActiveByAdmin(
      this.controlDb(),
      this.parseId(admin.id),
    );
    if (active) {
      throw new BadRequestException(
        "Ekspor sebelumnya masih diproses. Tunggu selesai lalu coba lagi.",
      );
    }
    const created = await this.jobs.insert(this.controlDb(), {
      requestedBy: this.parseId(admin.id),
      source,
      appSlug: this.sources[source].appScoped && ctx ? ctx.slug : null,
      filter: this.toJsonFor(source, repoFilter),
    });
    await this.activityLog.record({
      adminId: admin.id,
      appId: this.auditAppId(source, ctx, repoFilter),
      action: "export",
      entityType: "export_job",
      entityId: String(created.id),
      summary:
        `Mengekspor ${this.sources[source].label} ` +
        `(${total} baris) ke CSV`,
      ip,
    });
    return toItem(created);
  }

  /** Satu job milik admin; job orang lain terbaca sebagai tak ada. */
  async getJob(id: string, admin: AdminProfile): Promise<ExportJobItem> {
    return toItem(await this.mustOwn(id, admin));
  }

  async listJobs(
    admin: AdminProfile,
    limit = 10,
  ): Promise<ExportJobItem[]> {
    const clamped =
      Number.isInteger(limit) && limit > 0
        ? Math.min(limit, MAX_LIST_LIMIT)
        : 10;
    const rows = await this.jobs.listByAdmin(
      this.controlDb(),
      this.parseId(admin.id),
      clamped,
    );
    return rows.map(toItem);
  }

  /** Klaim job queued untuk runner (kunci di repository). */
  async claimQueued(now: Date, limit: number): Promise<ExportJobRow[]> {
    return this.jobs.claimQueued(this.controlDb(), now, limit);
  }

  /**
   * Eksekusi satu job ter-klaim dari runner: baca batch, tulis CSV,
   * tandai done. Gagal → failed dengan pesan aman untuk pengguna.
   */
  async executeClaimed(jobId: number): Promise<ExportExecuteOutcome> {
    const db = this.controlDb();
    const row = await this.jobs.findById(db, jobId);
    if (!row || row.status !== "running") {
      return "skipped";
    }
    try {
      const sourceDb = await this.sourceDb(
        row.source as ExportSourceKey,
        row.appSlug,
      );
      const { header, rows } = await this.collectRows(row, sourceDb);
      const buffer = serializeCsv(header, rows);
      const now = new Date();
      const fileName =
        `ekspor-${this.sources[row.source as ExportSourceKey].fileNamePrefix}-` +
        `${row.appSlug ?? "platform"}-${fileTimestamp(now)}.csv`;
      await this.store.put(`${row.id}.csv`, buffer);
      await this.jobs.markDone(db, row.id, {
        rowCount: rows.length,
        fileName,
        fileSizeBytes: buffer.length,
        expiresAt: new Date(
          now.getTime() + this.ttlHours * 60 * 60 * 1000,
        ),
        now,
      });
      return "done";
    } catch (error: unknown) {
      console.error(`Gagal mengeksekusi job ekspor ${row.id}:`, error);
      await this.jobs.markFailed(
        db,
        row.id,
        "Ekspor gagal diproses. Coba lagi.",
        new Date(),
      );
      return "failed";
    }
  }

  /**
   * Sapuan berkala: kedaluwarsakan job done yang lewat masa berlaku
   * (berkasnya dihapus) dan gagalkan job running yang macet.
   */
  async sweep(now: Date): Promise<{ expired: number; stale: number }> {
    const db = this.controlDb();
    const expired = await this.jobs.expireDue(db, now);
    for (const row of expired) {
      try {
        await this.store.delete(`${row.id}.csv`);
      } catch (error: unknown) {
        console.error(
          `Gagal menghapus berkas ekspor ${row.id}:`,
          error,
        );
      }
    }
    const stale = await this.jobs.failStaleRunning(
      db,
      now,
      new Date(now.getTime() - STALE_RUNNING_MINUTES * 60 * 1000),
    );
    return { expired: expired.length, stale };
  }

  async download(
    id: string,
    admin: AdminProfile,
    ip: string | null,
  ): Promise<ExportDownload> {
    const row = await this.mustOwn(id, admin);
    if (row.status === "expired") {
      throw new GoneException(
        "Tautan unduh sudah kedaluwarsa. Buat ekspor baru.",
      );
    }
    if (row.status !== "done") {
      throw new NotFoundException("Hasil ekspor tidak ditemukan.");
    }
    if (!row.expiresAt || row.expiresAt.getTime() <= Date.now()) {
      throw new GoneException(
        "Tautan unduh sudah kedaluwarsa. Buat ekspor baru.",
      );
    }
    if (!row.fileName) {
      throw new NotFoundException("Hasil ekspor tidak ditemukan.");
    }
    const absolutePath = this.store.absolutePath(`${row.id}.csv`);
    let sizeBytes = row.fileSizeBytes ?? 0;
    try {
      const stat = await fs.stat(absolutePath);
      if (!stat.isFile()) {
        throw new NotFoundException("Hasil ekspor tidak ditemukan.");
      }
      sizeBytes = stat.size;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (isEnoent(error)) {
        throw new NotFoundException("Hasil ekspor tidak ditemukan.");
      }
      throw error;
    }
    await this.activityLog.record({
      adminId: admin.id,
      appId: await this.downloadAuditAppId(row),
      action: "download",
      entityType: "export_job",
      entityId: String(row.id),
      summary:
        `Mengunduh hasil ekspor ${this.sources[row.source as ExportSourceKey].label} ` +
        `(${row.fileName})`,
      ip,
    });
    return { absolutePath, fileName: row.fileName, sizeBytes };
  }

  private async sourceDb(
    source: ExportSourceKey,
    slug: string | null,
  ): Promise<Db> {
    if (!this.sources[source].appScoped) {
      return this.controlDb();
    }
    if (!slug) {
      throw new BadRequestException("Konteks aplikasi wajib diisi.");
    }
    return this.database.getAppConnection(slug, { allowNonActive: true });
  }

  private toRepoFilter(
    source: ExportSourceKey,
    filter:
      | AppUsersExportFilter
      | ActivityLogsExportFilter
      | CbtResultsExportFilter,
  ): AppUserFilters | ActivityLogFilters | CbtResultFilters {
    if (source === "cbt_results") {
      const input = filter as CbtResultsExportFilter;
      const repo: CbtResultFilters = {};
      if (input.packageId !== undefined) {
        repo.packageId = this.parseId(input.packageId);
      }
      if (input.passed !== undefined) {
        repo.passed = input.passed;
      }
      return repo;
    }
    if (source === "app_users") {
      const input = filter as AppUsersExportFilter;
      const repo: AppUserFilters = {};
      if (input.search !== undefined) {
        repo.search = input.search;
      }
      if (input.status !== undefined) {
        repo.status = input.status;
      }
      return repo;
    }
    const input = filter as ActivityLogsExportFilter;
    const repo: ActivityLogFilters = {};
    if (input.dateFrom !== undefined) {
      repo.dateFrom = input.dateFrom;
    }
    if (input.dateTo !== undefined) {
      repo.dateTo = input.dateTo;
    }
    if (input.appId !== undefined) {
      repo.appId = this.parseId(input.appId);
    }
    if (input.adminId !== undefined) {
      repo.adminId = this.parseId(input.adminId);
    }
    if (input.entityType !== undefined) {
      repo.entityType = input.entityType;
    }
    if (input.action !== undefined) {
      repo.action = input.action;
    }
    if (input.search !== undefined) {
      repo.search = input.search;
    }
    return repo;
  }

  private countFor(
    source: ExportSourceKey,
    db: Db,
    filter: AppUserFilters | ActivityLogFilters | CbtResultFilters,
  ): Promise<number> {
    if (source === "cbt_results") {
      return this.sources.cbt_results.count(db, filter as CbtResultFilters);
    }
    if (source === "app_users") {
      return this.sources.app_users.count(db, filter as AppUserFilters);
    }
    return this.sources.activity_logs.count(db, filter as ActivityLogFilters);
  }

  private toJsonFor(
    source: ExportSourceKey,
    filter: AppUserFilters | ActivityLogFilters | CbtResultFilters,
  ): Record<string, unknown> {
    if (source === "cbt_results") {
      return this.sources.cbt_results.toJson(filter as CbtResultFilters);
    }
    if (source === "app_users") {
      return this.sources.app_users.toJson(filter as AppUserFilters);
    }
    return this.sources.activity_logs.toJson(filter as ActivityLogFilters);
  }

  private auditAppId(
    source: ExportSourceKey,
    ctx: ExportRequestContext | null,
    filter: AppUserFilters | ActivityLogFilters | CbtResultFilters,
  ): string | null {
    if (source === "app_users" || source === "cbt_results") {
      return ctx ? ctx.appId : null;
    }
    const appId = (filter as ActivityLogFilters).appId;
    return appId === undefined ? null : String(appId);
  }

  /**
   * Baca seluruh baris satu job per batch memakai definisi sumbernya
   * (filter, count, dan kolom ikut definisi — tidak ada cabang per
   * sumber selain pemilihan definisinya).
   */
  private async collectWith<Row, RepoFilter>(
    def: ExportSourceDef<Row, RepoFilter>,
    filterJson: ExportJobRow["filter"],
    db: Db,
  ): Promise<{ header: string[]; rows: CsvCellValue[][] }> {
    const filter = def.fromJson(filterJson);
    const out: CsvCellValue[][] = [];
    let offset = 0;
    for (;;) {
      const batch = await def.listBatch(db, filter, {
        limit: BATCH_SIZE,
        offset,
      });
      for (const item of batch) {
        out.push(cellsOf(def, item));
      }
      offset += batch.length;
      if (batch.length < BATCH_SIZE) {
        break;
      }
    }
    return { header: def.columns.map((c) => c.header), rows: out };
  }

  private async collectRows(
    row: ExportJobRow,
    db: Db,
  ): Promise<{ header: string[]; rows: CsvCellValue[][] }> {
    if (row.source === "cbt_results") {
      return this.collectWith(this.sources.cbt_results, row.filter, db);
    }
    if (row.source === "app_users") {
      return this.collectWith(this.sources.app_users, row.filter, db);
    }
    return this.collectWith(this.sources.activity_logs, row.filter, db);
  }

  private async downloadAuditAppId(row: ExportJobRow): Promise<string | null> {
    if (row.source === "cbt_results") {
      if (!row.appSlug) {
        return null;
      }
      const app = await this.apps.findBySlug(this.controlDb(), row.appSlug);
      return app ? String(app.id) : null;
    }
    if (row.source === "app_users") {
      if (!row.appSlug) {
        return null;
      }
      const app = await this.apps.findBySlug(
        this.controlDb(),
        row.appSlug,
      );
      return app ? String(app.id) : null;
    }
    const filter = this.sources.activity_logs.fromJson(row.filter);
    return filter.appId === undefined ? null : String(filter.appId);
  }

  private async mustOwn(
    id: string,
    admin: AdminProfile,
  ): Promise<ExportJobRow> {
    const row = await this.jobs.findById(
      this.controlDb(),
      this.parseId(id),
    );
    if (!row || row.requestedBy !== this.parseId(admin.id)) {
      throw new NotFoundException("Job ekspor tidak ditemukan.");
    }
    return row;
  }

  private parseId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }
}

function positiveIntOf(value: unknown, fallback: number): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
    ? value
    : fallback;
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
