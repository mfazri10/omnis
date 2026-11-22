import {
  BadRequestException,
  GoneException,
  NotFoundException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { promises as fsPromises } from "node:fs";
import type { Db } from "../../../database/database.service";
import type { DatabaseService } from "../../../database/database.service";
import type { AdminProfile } from "../admins/admins.service";
import type { ActivityLogService } from "../activity-logs/activity-log.service";
import type {
  ActivityLogFilters,
  ActivityLogListItem,
} from "../activity-logs/activity-logs.repository";
import type { ActivityLogsRepository } from "../activity-logs/activity-logs.repository";
import type { AppUserRow } from "../app-users/app-users.entity";
import type { AppUserFilters } from "../app-users/app-users.repository";
import type { AppUsersRepository } from "../app-users/app-users.repository";
import type { CbtSessionsRepository } from "../../cbt/sessions.repository";
import type { CbtResultListItem } from "../../cbt/sessions.repository";
import type { CbtResultFilters } from "./export-sources";
import type { AppRow } from "../entities/apps.entity";
import type { AppsRepository } from "../apps/apps.repository";
import type { ExportJobRow } from "../entities/export-jobs.entity";
import type { ExportFileStore } from "./export-file-store";
import type { ExportsRepository } from "./exports.repository";
import type { ExportsService } from "./exports.service";
import { ExportJobStatus, ExportSource } from "./types/export-job.type";

type Mocked<T> = { [K in keyof T]: jest.Mock };

const CONTROL_DB = {} as Db;
const APP_DB = {} as Db;
const ADMIN: AdminProfile = {
  id: "7",
  authUserId: "auth-7",
  name: "Admin Uji",
  email: "admin@contoh.id",
  isSuperAdmin: false,
};

function job(over: Partial<ExportJobRow> = {}): ExportJobRow {
  return {
    id: 7,
    requestedBy: 7,
    source: "app_users",
    status: "queued",
    appSlug: "tes-cpns",
    filter: {},
    rowCount: null,
    fileName: null,
    fileSizeBytes: null,
    errorMessage: null,
    expiresAt: null,
    createdAt: new Date("2026-11-21T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
    ...over,
  };
}

function appUser(over: Partial<AppUserRow> = {}): AppUserRow {
  return {
    id: 1,
    name: "Budi",
    email: "budi@contoh.id",
    phone: null,
    avatarUrl: null,
    isActive: true,
    metadata: null,
    lastLoginAt: null,
    createdAt: new Date("2026-11-20T00:00:00.000Z"),
    updatedAt: new Date("2026-11-20T00:00:00.000Z"),
    ...over,
  };
}

function auditRow(over: Partial<ActivityLogListItem> = {}): ActivityLogListItem {
  return {
    id: 1,
    adminId: 7,
    adminName: "Admin Uji",
    appId: 4,
    appName: "Tes CPNS",
    appSlug: "tes-cpns",
    action: "create",
    entityType: "app_user",
    entityId: "1",
    summary: "Menambah user Budi",
    ipAddress: "203.0.113.7",
    createdAt: new Date("2026-11-20T00:00:00.000Z"),
    ...over,
  };
}

function cbtResult(
  over: Partial<CbtResultListItem> = {},
): CbtResultListItem {
  return {
    id: 1,
    sessionId: 11,
    participantName: "Peserta Uji",
    packageId: 5,
    packageTitle: "Paket SKD",
    twkScore: 5,
    tiuScore: 5,
    tkpScore: 5,
    totalScore: 15,
    passed: true,
    computedAt: new Date("2026-11-22T02:00:00.000Z"),
    finishedAt: new Date("2026-11-22T02:00:00.000Z"),
    ...over,
  };
}

function app(over: Partial<AppRow> = {}): AppRow {
  return {
    id: 3,
    name: "Tes CPNS",
    slug: "tes-cpns",
    iconMediaUrl: null,
    status: "active",
    dbName: "app_tes_cpns",
    androidPackage: null,
    iosBundleId: null,
    storeUrlAndroid: null,
    storeUrlIos: null,
    fcmCredential: null,
    notes: null,
    modules: [],
    failureReason: null,
    lastProvisioningAt: null,
    createdAt: new Date("2026-11-17T00:00:00.000Z"),
    updatedAt: new Date("2026-11-17T00:00:00.000Z"),
    ...over,
  };
}

async function loadService(
  configValues: Record<string, string | number> = {},
): Promise<{
  service: ExportsService;
  database: Mocked<DatabaseService>;
  jobs: Mocked<ExportsRepository>;
  appUsers: Mocked<AppUsersRepository>;
  activityLogs: Mocked<ActivityLogsRepository>;
  apps: Mocked<AppsRepository>;
  activityLog: Mocked<ActivityLogService>;
  store: Mocked<ExportFileStore>;
  cbtSessions: Mocked<CbtSessionsRepository>;
}> {
  const { ExportsService: Service } = await import("./exports.service");
  const database = {
    getControlPlaneConnection: jest.fn().mockReturnValue(CONTROL_DB),
    getAppConnection: jest.fn().mockResolvedValue(APP_DB),
  } as unknown as Mocked<DatabaseService>;
  const jobs = {
    insert: jest.fn(),
    findById: jest.fn(),
    listByAdmin: jest.fn(),
    findActiveByAdmin: jest.fn(),
    claimQueued: jest.fn(),
    markDone: jest.fn(),
    markFailed: jest.fn(),
    expireDue: jest.fn(),
    failStaleRunning: jest.fn(),
  } as unknown as Mocked<ExportsRepository>;
  const appUsers = {
    count: jest.fn(),
    list: jest.fn(),
  } as unknown as Mocked<AppUsersRepository>;
  const activityLogs = {
    count: jest.fn(),
    list: jest.fn(),
  } as unknown as Mocked<ActivityLogsRepository>;
  const cbtSessions = {
    countResults: jest.fn(),
    listResults: jest.fn(),
  } as unknown as Mocked<CbtSessionsRepository>;
  const apps = {
    findBySlug: jest.fn(),
  } as unknown as Mocked<AppsRepository>;
  const activityLog = {
    record: jest.fn(),
  } as unknown as Mocked<ActivityLogService>;
  const store = {
    put: jest.fn(),
    delete: jest.fn(),
    absolutePath: jest.fn((key: string) => `/tmp/ekspor/${key}`),
  } as unknown as Mocked<ExportFileStore>;
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const service = new Service(
    database as unknown as DatabaseService,
    config,
    jobs,
    appUsers,
    activityLogs,
    cbtSessions,
    apps,
    activityLog as unknown as ActivityLogService,
    store as unknown as ExportFileStore,
  );
  return {
    service,
    database,
    jobs,
    appUsers,
    activityLogs,
    cbtSessions,
    apps,
    activityLog,
    store,
  };
}

describe("ExportsService.request", () => {
  it("menolak bila tak ada data yang cocok dengan filter", async () => {
    const { service, appUsers } = await loadService();
    appUsers.count.mockResolvedValue(0);

    await expect(
      service.request(
        "app_users",
        { search: "tak-ada" },
        ADMIN,
        { appId: "3", slug: "tes-cpns" },
        null,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.request(
        "app_users",
        { search: "tak-ada" },
        ADMIN,
        { appId: "3", slug: "tes-cpns" },
        null,
      ),
    ).rejects.toThrow("Tidak ada data yang cocok dengan filter");
  });

  it("menolak bila jumlah baris melebihi batas dan menyebut angkanya", async () => {
    const { service, appUsers } = await loadService({ EXPORT_MAX_ROWS: 2 });
    appUsers.count.mockResolvedValue(3);

    const error = await service
      .request("app_users", {}, ADMIN, { appId: "3", slug: "tes-cpns" }, null)
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toContain("3");
    expect((error as Error).message).toContain("2");
  });

  it("menolak job kedua selagi job admin masih aktif", async () => {
    const { service, appUsers, jobs } = await loadService();
    appUsers.count.mockResolvedValue(5);
    jobs.findActiveByAdmin.mockResolvedValue(job({ status: "running" }));

    await expect(
      service.request(
        "app_users",
        {},
        ADMIN,
        { appId: "3", slug: "tes-cpns" },
        null,
      ),
    ).rejects.toThrow("Ekspor sebelumnya masih diproses");
    expect(jobs.insert).not.toHaveBeenCalled();
  });

  it("menyimpan job queued dan mencatat audit ekspor", async () => {
    const { service, appUsers, jobs, activityLog, database } =
      await loadService();
    appUsers.count.mockResolvedValue(5);
    jobs.findActiveByAdmin.mockResolvedValue(null);
    jobs.insert.mockResolvedValue(job({ id: 9, status: "queued" }));

    const item = await service.request(
      "app_users",
      { search: "budi", status: "active" },
      ADMIN,
      { appId: "3", slug: "tes-cpns" },
      "203.0.113.7",
    );

    expect(database.getAppConnection).toHaveBeenCalledWith("tes-cpns", {
      allowNonActive: true,
    });
    expect(appUsers.count).toHaveBeenCalledWith(APP_DB, {
      search: "budi",
      status: "active",
    } satisfies AppUserFilters);
    expect(jobs.insert).toHaveBeenCalledWith(CONTROL_DB, {
      requestedBy: 7,
      source: "app_users",
      appSlug: "tes-cpns",
      filter: { search: "budi", status: "active" },
    });
    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "7",
      appId: "3",
      action: "export",
      entityType: "export_job",
      entityId: "9",
      summary: "Mengekspor user aplikasi (5 baris) ke CSV",
      ip: "203.0.113.7",
    });
    expect(item.source).toBe(ExportSource.APP_USERS);
    expect(item.status).toBe(ExportJobStatus.QUEUED);
    expect(item.downloadPath).toBeNull();
  });

  it("ekspor hasil CBT memakai App DB, filter paket, dan audit konteks aplikasi", async () => {
    const { service, cbtSessions, jobs, activityLog, database } =
      await loadService();
    cbtSessions.countResults.mockResolvedValue(2);
    jobs.findActiveByAdmin.mockResolvedValue(null);
    jobs.insert.mockResolvedValue(
      job({ id: 12, source: "cbt_results", status: "queued" }),
    );

    const item = await service.request(
      "cbt_results",
      { packageId: "5", passed: true },
      ADMIN,
      { appId: "3", slug: "tes-cpns" },
      null,
    );

    expect(database.getAppConnection).toHaveBeenCalledWith("tes-cpns", {
      allowNonActive: true,
    });
    expect(cbtSessions.countResults).toHaveBeenCalledWith(APP_DB, {
      packageId: 5,
      passed: true,
    } satisfies CbtResultFilters);
    expect(jobs.insert).toHaveBeenCalledWith(CONTROL_DB, {
      requestedBy: 7,
      source: "cbt_results",
      appSlug: "tes-cpns",
      filter: { packageId: 5, passed: true },
    });
    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "7",
      appId: "3",
      action: "export",
      entityType: "export_job",
      entityId: "12",
      summary: "Mengekspor hasil CBT (2 baris) ke CSV",
      ip: null,
    });
    expect(item.source).toBe(ExportSource.CBT_RESULTS);
    expect(item.status).toBe(ExportJobStatus.QUEUED);
  });

  it("ekspor hasil CBT di aplikasi tanpa modul dijawab pesan modul, bukan error server", async () => {
    const { service, cbtSessions } = await loadService();
    const undefinedTable = Object.assign(new Error("relation does not exist"), {
      cause: { code: "42P01" },
    });
    cbtSessions.countResults.mockRejectedValue(undefinedTable);

    const error = await service
      .request(
        "cbt_results",
        {},
        ADMIN,
        { appId: "3", slug: "tes-cpns" },
        null,
      )
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toContain("belum terpasang");
  });

  it("ekspor audit memakai control-plane dan menyimpan tanggal ISO", async () => {
    const { service, activityLogs, jobs, activityLog, database } =
      await loadService();
    activityLogs.count.mockResolvedValue(4);
    jobs.findActiveByAdmin.mockResolvedValue(null);
    jobs.insert.mockResolvedValue(
      job({ id: 10, source: "activity_logs", appSlug: null }),
    );

    await service.request(
      "activity_logs",
      {
        dateFrom: new Date("2026-11-01T00:00:00.000Z"),
        dateTo: new Date("2026-11-21T00:00:00.000Z"),
        appId: "4",
        action: "create",
      },
      ADMIN,
      null,
      null,
    );

    expect(database.getAppConnection).not.toHaveBeenCalled();
    expect(activityLogs.count).toHaveBeenCalledWith(CONTROL_DB, {
      dateFrom: new Date("2026-11-01T00:00:00.000Z"),
      dateTo: new Date("2026-11-21T00:00:00.000Z"),
      appId: 4,
      action: "create",
    } satisfies ActivityLogFilters);
    expect(jobs.insert).toHaveBeenCalledWith(CONTROL_DB, {
      requestedBy: 7,
      source: "activity_logs",
      appSlug: null,
      filter: {
        dateFrom: "2026-11-01T00:00:00.000Z",
        dateTo: "2026-11-21T00:00:00.000Z",
        appId: 4,
        action: "create",
      },
    });
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ appId: "4", action: "export" }),
    );
  });

  it("audit ekspor audit tanpa filter aplikasi memakai appId null", async () => {
    const { service, activityLogs, jobs, activityLog } = await loadService();
    activityLogs.count.mockResolvedValue(2);
    jobs.findActiveByAdmin.mockResolvedValue(null);
    jobs.insert.mockResolvedValue(job({ id: 11, source: "activity_logs" }));

    await service.request("activity_logs", {}, ADMIN, null, null);

    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ appId: null }),
    );
  });

  it("menolak ID filter audit yang tidak valid", async () => {
    const { service } = await loadService();

    await expect(
      service.request("activity_logs", { appId: "rusak" }, ADMIN, null, null),
    ).rejects.toThrow("ID tidak valid.");
  });
});

describe("ExportsService.getJob dan listJobs", () => {
  it("job milik admin lain terbaca sebagai tidak ditemukan", async () => {
    const { service, jobs } = await loadService();
    jobs.findById.mockResolvedValue(job({ requestedBy: 99 }));

    await expect(service.getJob("7", ADMIN)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("job sendiri yang done membawa downloadPath", async () => {
    const { service, jobs } = await loadService();
    jobs.findById.mockResolvedValue(
      job({ status: "done", rowCount: 5, fileName: "ekspor.csv" }),
    );

    const item = await service.getJob("7", ADMIN);

    expect(item.downloadPath).toBe("/exports/7/download");
    expect(item.status).toBe(ExportJobStatus.DONE);
    expect(item.rowCount).toBe(5);
  });

  it("limit daftar dibatasi maksimal 20", async () => {
    const { service, jobs } = await loadService();
    jobs.listByAdmin.mockResolvedValue([]);

    await service.listJobs(ADMIN, 99);

    expect(jobs.listByAdmin).toHaveBeenCalledWith(CONTROL_DB, 7, 20);
  });
});

describe("ExportsService.executeClaimed", () => {
  it("melewati job yang hilang atau bukan running", async () => {
    const { service, jobs } = await loadService();
    jobs.findById.mockResolvedValueOnce(null);
    jobs.findById.mockResolvedValueOnce(job({ status: "queued" }));

    await expect(service.executeClaimed(7)).resolves.toBe("skipped");
    await expect(service.executeClaimed(7)).resolves.toBe("skipped");
  });

  it("menulis CSV batch dan menandai done beserta kedaluwarsa", async () => {
    const { service, jobs, appUsers, store } = await loadService({
      EXPORT_TTL_HOURS: 24,
    });
    jobs.findById.mockResolvedValue(
      job({ status: "running", filter: { status: "active" } }),
    );
    appUsers.list.mockResolvedValue([
      appUser({ id: 1, name: "Budi" }),
      appUser({ id: 2, name: "Sari", email: null, phone: "+6281" }),
    ]);
    jobs.markDone.mockResolvedValue(job({ status: "done" }));
    const before = Date.now();

    const outcome = await service.executeClaimed(7);

    expect(outcome).toBe("done");
    expect(appUsers.list).toHaveBeenCalledWith(
      APP_DB,
      { status: "active" },
      { limit: 1000, offset: 0 },
    );
    expect(store.put).toHaveBeenCalledTimes(1);
    const [key, buffer] = store.put.mock.calls[0] as [string, Buffer];
    expect(key).toBe("7.csv");
    const text = buffer.toString("utf8");
    expect(text).toContain("id,name,email,phone,isActive");
    expect(text).toContain("Budi");
    expect(text).toContain("Sari");
    expect(jobs.markDone).toHaveBeenCalledWith(
      CONTROL_DB,
      7,
      expect.objectContaining({ rowCount: 2 }),
    );
    const markDoneCalls = jobs.markDone.mock.calls as unknown[][];
    const patch = markDoneCalls[0]?.[2] as {
      fileName: string;
      fileSizeBytes: number;
      expiresAt: Date;
    };
    expect(patch.fileName).toMatch(
      /^ekspor-user-aplikasi-tes-cpns-\d{8}-\d{6}\.csv$/,
    );
    expect(patch.fileSizeBytes).toBe(buffer.length);
    expect(patch.expiresAt.getTime()).toBeGreaterThan(
      before + 23 * 60 * 60 * 1000,
    );
  });

  it("menulis CSV hasil CBT sesuai kolom sumbernya", async () => {
    const { service, jobs, cbtSessions, store } = await loadService();
    jobs.findById.mockResolvedValue(
      job({
        status: "running",
        source: "cbt_results",
        filter: { passed: true },
      }),
    );
    cbtSessions.listResults.mockResolvedValue([cbtResult()]);
    jobs.markDone.mockResolvedValue(job({ status: "done" }));

    const outcome = await service.executeClaimed(7);

    expect(outcome).toBe("done");
    expect(cbtSessions.listResults).toHaveBeenCalledWith(
      APP_DB,
      { passed: true },
      { limit: 1000, offset: 0 },
    );
    const [, buffer] = store.put.mock.calls[0] as [string, Buffer];
    const text = buffer.toString("utf8");
    expect(text).toContain(
      "id,sessionId,participantName,packageId,packageTitle,twkScore,tiuScore,tkpScore,totalScore,passed,computedAt,finishedAt",
    );
    expect(text).toContain("Peserta Uji");
    expect(text).toContain("Paket SKD");
    const markDoneCalls = jobs.markDone.mock.calls as unknown[][];
    const patch = markDoneCalls[0]?.[2] as { fileName: string; rowCount: number };
    expect(patch.rowCount).toBe(1);
    expect(patch.fileName).toMatch(
      /^ekspor-hasil-cbt-tes-cpns-\d{8}-\d{6}\.csv$/,
    );
  });

  it("membaca batch berulang sampai batch pendek", async () => {
    const { service, jobs, activityLogs, store } = await loadService();
    jobs.findById.mockResolvedValue(
      job({ status: "running", source: "activity_logs", appSlug: null }),
    );
    const batch = Array.from({ length: 1000 }, (_, i) =>
      auditRow({ id: i + 1 }),
    );
    activityLogs.list
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce([auditRow({ id: 1001 })]);
    jobs.markDone.mockResolvedValue(job({ status: "done" }));

    await service.executeClaimed(7);

    expect(activityLogs.list).toHaveBeenCalledTimes(2);
    expect(activityLogs.list).toHaveBeenNthCalledWith(
      2,
      CONTROL_DB,
      {},
      { limit: 1000, offset: 1000 },
    );
    expect(jobs.markDone).toHaveBeenCalledWith(
      CONTROL_DB,
      7,
      expect.objectContaining({ rowCount: 1001 }),
    );
    expect(store.put).toHaveBeenCalledTimes(1);
  });

  it("kegagalan eksekusi menandai failed dengan pesan aman", async () => {
    const { service, jobs, appUsers } = await loadService();
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      jobs.findById.mockResolvedValue(job({ status: "running" }));
      appUsers.list.mockRejectedValue(new Error("koneksi DB rahasia-xyz"));

      const outcome = await service.executeClaimed(7);

      expect(outcome).toBe("failed");
      expect(jobs.markFailed).toHaveBeenCalledWith(
        CONTROL_DB,
        7,
        "Ekspor gagal diproses. Coba lagi.",
        expect.any(Date),
      );
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("ExportsService.sweep", () => {
  it("menghapus berkas job kedaluwarsa dan menggagalkan yang macet", async () => {
    const { service, jobs, store } = await loadService();
    const now = new Date("2026-11-21T10:00:00.000Z");
    jobs.expireDue.mockResolvedValue([job({ id: 5 }), job({ id: 6 })]);
    jobs.failStaleRunning.mockResolvedValue(2);

    const result = await service.sweep(now);

    expect(jobs.expireDue).toHaveBeenCalledWith(CONTROL_DB, now);
    expect(store.delete).toHaveBeenCalledWith("5.csv");
    expect(store.delete).toHaveBeenCalledWith("6.csv");
    expect(jobs.failStaleRunning).toHaveBeenCalledWith(
      CONTROL_DB,
      now,
      new Date(now.getTime() - 10 * 60 * 1000),
    );
    expect(result).toEqual({ expired: 2, stale: 2 });
  });
});

describe("ExportsService.download", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000);

  function mockFileExists(size = 128): jest.SpyInstance {
    return jest.spyOn(fsPromises, "stat").mockResolvedValue({
      isFile: () => true,
      size,
    } as unknown as Awaited<ReturnType<typeof fsPromises.stat>>);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("job admin lain atau bukan done → NotFound", async () => {
    const { service, jobs } = await loadService();
    jobs.findById.mockResolvedValueOnce(job({ requestedBy: 99 }));
    jobs.findById.mockResolvedValueOnce(job({ status: "running" }));
    jobs.findById.mockResolvedValueOnce(job({ status: "failed" }));

    await expect(service.download("7", ADMIN, null)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.download("7", ADMIN, null)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.download("7", ADMIN, null)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("job kedaluwarsa → Gone dengan pesan membuat ekspor baru", async () => {
    const { service, jobs } = await loadService();
    jobs.findById.mockResolvedValueOnce(job({ status: "expired" }));
    jobs.findById.mockResolvedValueOnce(
      job({
        status: "done",
        fileName: "ekspor.csv",
        expiresAt: new Date(Date.now() - 1000),
      }),
    );

    const first = await service
      .download("7", ADMIN, null)
      .catch((err: unknown) => err);
    expect(first).toBeInstanceOf(GoneException);
    expect((first as Error).message).toContain("Buat ekspor baru");
    await expect(service.download("7", ADMIN, null)).rejects.toThrow(
      GoneException,
    );
  });

  it("unduhan valid mengembalikan path dan mencatat audit", async () => {
    const { service, jobs, apps, activityLog, store } = await loadService();
    const statSpy = mockFileExists(256);
    jobs.findById.mockResolvedValue(
      job({
        status: "done",
        fileName: "ekspor-user-aplikasi-tes-cpns-20261121-100000.csv",
        fileSizeBytes: 200,
        expiresAt: future,
      }),
    );
    apps.findBySlug.mockResolvedValue(app({ id: 3 }));
    try {
      const file = await service.download("7", ADMIN, "203.0.113.7");

      expect(store.absolutePath).toHaveBeenCalledWith("7.csv");
      expect(file).toEqual({
        absolutePath: "/tmp/ekspor/7.csv",
        fileName: "ekspor-user-aplikasi-tes-cpns-20261121-100000.csv",
        sizeBytes: 256,
      });
      expect(activityLog.record).toHaveBeenCalledWith({
        adminId: "7",
        appId: "3",
        action: "download",
        entityType: "export_job",
        entityId: "7",
        summary:
          "Mengunduh hasil ekspor user aplikasi " +
          "(ekspor-user-aplikasi-tes-cpns-20261121-100000.csv)",
        ip: "203.0.113.7",
      });
    } finally {
      statSpy.mockRestore();
    }
  });

  it("berkas hilang di disk → NotFound", async () => {
    const { service, jobs } = await loadService();
    const statSpy = jest
      .spyOn(fsPromises, "stat")
      .mockRejectedValue(Object.assign(new Error("hilang"), { code: "ENOENT" }));
    try {
      jobs.findById.mockResolvedValue(
        job({ status: "done", fileName: "ekspor.csv", expiresAt: future }),
      );

      await expect(service.download("7", ADMIN, null)).rejects.toThrow(
        NotFoundException,
      );
    } finally {
      statSpy.mockRestore();
    }
  });
});
