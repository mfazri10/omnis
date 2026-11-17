import type { DatabaseService, Db } from "../../../database/database.service";
import type { AppContext } from "../../../common/types/request-context";
import type { AppRow } from "../entities/apps.entity";
import type { ActivityLogService, ActivityLogItem } from "../activity-logs/activity-log.service";
import type { AppsRepository } from "../apps/apps.repository";
import type { AppUsersRepository } from "../app-users/app-users.repository";
import { DASHBOARD_CONCURRENCY, DashboardService } from "./dashboard.service";
import type { DashboardRepository } from "./dashboard.repository";
import type { DashboardSection } from "./dashboard-section";

type Mocked<T> = { [K in keyof T]: jest.Mock };

const CONTROL_DB = {} as Db;
const APP_DB = {} as Db;

function appRow(over: Partial<AppRow> = {}): AppRow {
  return {
    id: 1,
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
    failureReason: null,
    lastProvisioningAt: null,
    createdAt: new Date("2026-11-17T00:00:00.000Z"),
    updatedAt: new Date("2026-11-17T00:00:00.000Z"),
    ...over,
  };
}

function activityItem(over: Partial<ActivityLogItem> = {}): ActivityLogItem {
  return {
    id: "9",
    adminId: "7",
    adminName: "Sari",
    appId: "1",
    appName: "Tes CPNS",
    appSlug: "tes-cpns",
    action: "update",
    entityType: "app_config",
    entityId: "1",
    summary: "Mengubah konfigurasi aplikasi Tes CPNS",
    ipAddress: null,
    createdAt: new Date("2026-11-17T00:00:00.000Z"),
    ...over,
  };
}

function section(
  key: string,
  label: string,
  value: number,
  hint?: string,
): DashboardSection {
  return {
    key,
    label,
    resolve: jest.fn().mockResolvedValue({ value, hint }),
  };
}

function ctx(over: Partial<AppContext> = {}): AppContext {
  return {
    appId: "1",
    slug: "tes-cpns",
    name: "Tes CPNS",
    status: "active",
    dbName: "app_tes_cpns",
    ...over,
  };
}

interface Harness {
  service: DashboardService;
  database: Mocked<DatabaseService>;
  apps: Mocked<AppsRepository>;
  activityLog: Mocked<ActivityLogService>;
  dashboard: Mocked<DashboardRepository>;
  appUsers: Mocked<AppUsersRepository>;
}

async function loadService(
  sections: DashboardSection[] = [section("users", "User Aplikasi", 12)],
): Promise<Harness> {
  const { DashboardService: Service } = await import("./dashboard.service");
  const database = {
    getControlPlaneConnection: jest.fn().mockReturnValue(CONTROL_DB),
    databaseExists: jest.fn().mockResolvedValue(true),
    getAppConnection: jest.fn().mockResolvedValue(APP_DB),
  } as unknown as Mocked<DatabaseService>;
  const apps = { list: jest.fn() } as unknown as Mocked<AppsRepository>;
  const activityLog = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  } as unknown as Mocked<ActivityLogService>;
  const dashboard = {
    countCampaignsByStatus: jest.fn().mockResolvedValue({}),
    countActivitiesSince: jest.fn().mockResolvedValue(0),
  } as unknown as Mocked<DashboardRepository>;
  const appUsers = {
    count: jest.fn().mockResolvedValue(0),
  } as unknown as Mocked<AppUsersRepository>;
  const service = new Service(
    database as unknown as DatabaseService,
    apps,
    activityLog as unknown as ActivityLogService,
    dashboard,
    appUsers,
    sections,
  );
  return { service, database, apps, activityLog, dashboard, appUsers };
}

describe("DashboardService.platformDashboard", () => {
  it("menggabungkan kartu aplikasi, aktivitas, dan antrean dengan benar", async () => {
    const { service, apps, activityLog, dashboard, appUsers } =
      await loadService();
    apps.list.mockResolvedValue([
      appRow({ id: 1, slug: "tes-cpns", name: "Tes CPNS" }),
      appRow({
        id: 2,
        slug: "ngewarung",
        name: "Ngewarung",
        dbName: "app_ngewarung",
      }),
    ]);
    activityLog.list.mockResolvedValue({
      items: [activityItem()],
      total: 1,
    });
    dashboard.countCampaignsByStatus.mockResolvedValue({
      draft: 2,
      scheduled: 3,
      sending: 1,
      sent: 9,
      failed: 4,
      cancelled: 1,
    });
    dashboard.countActivitiesSince.mockImplementation(
      (_db: Db, appId: number) => (appId === 1 ? 5 : 7),
    );
    appUsers.count.mockImplementation((db: Db) =>
      db === APP_DB ? 12 : 0,
    );

    const result = await service.platformDashboard();

    expect(apps.list).toHaveBeenCalledWith(CONTROL_DB, { statuses: null });
    expect(result.apps).toEqual([
      {
        id: "1",
        slug: "tes-cpns",
        name: "Tes CPNS",
        status: "active",
        userCount: 12,
        activityCount7d: 5,
      },
      {
        id: "2",
        slug: "ngewarung",
        name: "Ngewarung",
        status: "active",
        userCount: 12,
        activityCount7d: 7,
      },
    ]);
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0]?.adminName).toBe("Sari");
    expect(result.notificationQueue).toEqual({
      scheduled: 3,
      sending: 1,
      failed: 4,
    });
    expect(activityLog.list).toHaveBeenCalledWith({ page: 1, perPage: 10 });
  });

  it("aplikasi tanpa App DB tetap tampil bernilai 0 tanpa query App DB", async () => {
    const { service, apps, database, dashboard, appUsers } =
      await loadService();
    apps.list.mockResolvedValue([
      appRow({ id: 1 }),
      appRow({
        id: 2,
        slug: "gagal-provision",
        name: "Gagal Provision",
        status: "failed",
        dbName: "app_gagal_provision",
      }),
    ]);
    database.databaseExists.mockImplementation(
      (dbName: string) => dbName === "app_tes_cpns",
    );
    appUsers.count.mockResolvedValue(12);

    const result = await service.platformDashboard();

    expect(result.apps).toHaveLength(2);
    expect(result.apps[0]).toMatchObject({ slug: "tes-cpns", userCount: 12 });
    expect(result.apps[1]).toMatchObject({
      slug: "gagal-provision",
      status: "failed",
      userCount: 0,
    });
    // DB tak ada: getAppConnection tak pernah dipanggil untuk slug itu.
    expect(database.getAppConnection).toHaveBeenCalledTimes(1);
    expect(database.getAppConnection).toHaveBeenCalledWith("tes-cpns", {
      allowNonActive: true,
    });
    // Aktivitas control-plane tetap dihitung untuk kedua aplikasi.
    expect(dashboard.countActivitiesSince).toHaveBeenCalledTimes(2);
  });

  it("koneksi App DB yang melempar ditangkap per aplikasi (dasbor utuh)", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { service, apps, database, appUsers } = await loadService();
      apps.list.mockResolvedValue([
        appRow({ id: 1 }),
        appRow({
          id: 2,
          slug: "rusak",
          name: "Rusak",
          status: "archived",
          dbName: "app_rusak",
        }),
      ]);
      database.getAppConnection.mockImplementation((slug: string) => {
        if (slug === "rusak") {
          throw new Error("database \"app_rusak\" does not exist");
        }
        return APP_DB;
      });
      appUsers.count.mockResolvedValue(3);

      const result = await service.platformDashboard();

      expect(result.apps[0]).toMatchObject({ userCount: 3 });
      expect(result.apps[1]).toMatchObject({
        slug: "rusak",
        status: "archived",
        userCount: 0,
      });
    } finally {
      error.mockRestore();
    }
  });

  it("tanpa aplikasi mengembalikan daftar kosong (bukan error)", async () => {
    const { service, apps } = await loadService();
    apps.list.mockResolvedValue([]);

    const result = await service.platformDashboard();

    expect(result.apps).toEqual([]);
    expect(result.recentActivity).toEqual([]);
    expect(result.notificationQueue).toEqual({
      scheduled: 0,
      sending: 0,
      failed: 0,
    });
  });

  /**
   * Pendekatan uji paralelisme: mock kerja per aplikasi mencatat arus
   * bersamaan (naik saat masuk, turun setelah tunda 10 msk). Implementasi
   * serial tak pernah melewati 1; pool pekerja 4 mencapai 4 sebelum tunda
   * mana pun selesai. Batas atas menjamin tak pernah tak terbatas.
   */
  it("kerja per aplikasi paralel dengan batas DASHBOARD_CONCURRENCY", async () => {
    const { service, apps, database, dashboard } = await loadService();
    const rows = Array.from({ length: 9 }, (_v, index) =>
      appRow({
        id: index + 1,
        slug: `app-${index + 1}`,
        name: `App ${index + 1}`,
        dbName: `app_app_${index + 1}`,
      }),
    );
    apps.list.mockResolvedValue(rows);
    database.databaseExists.mockResolvedValue(false);
    let inFlight = 0;
    let maxInFlight = 0;
    dashboard.countActivitiesSince.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return 0;
    });

    const result = await service.platformDashboard();

    expect(result.apps).toHaveLength(9);
    expect(DASHBOARD_CONCURRENCY).toBe(4);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(DASHBOARD_CONCURRENCY);
  });
});

describe("DashboardService.appDashboard", () => {
  it("memakai konteks aplikasi + filter app_id pada aktivitas", async () => {
    const { service, activityLog, dashboard, database } = await loadService([
      section("users", "User Aplikasi", 12, "12 user terdaftar"),
      section("media", "File Media", 4, "4 file tersimpan"),
    ]);
    activityLog.list.mockResolvedValue({
      items: [activityItem()],
      total: 1,
    });
    dashboard.countCampaignsByStatus.mockResolvedValue({
      draft: 1,
      scheduled: 2,
      sent: 3,
      failed: 0,
    });

    const result = await service.appDashboard(ctx({ appId: "2" }), APP_DB);

    expect(result.app).toEqual({
      id: "2",
      slug: "tes-cpns",
      name: "Tes CPNS",
      status: "active",
    });
    expect(activityLog.list).toHaveBeenCalledWith({
      filter: { appId: "2" },
      page: 1,
      perPage: 10,
    });
    expect(dashboard.countCampaignsByStatus).toHaveBeenCalledWith(
      CONTROL_DB,
      2,
    );
    expect(database.getAppConnection).not.toHaveBeenCalled();
    expect(result.sections).toEqual([
      {
        key: "users",
        label: "User Aplikasi",
        value: 12,
        hint: "12 user terdaftar",
      },
      { key: "media", label: "File Media", value: 4, hint: "4 file tersimpan" },
    ]);
    expect(result.campaigns).toEqual({
      draft: 1,
      scheduled: 2,
      sent: 3,
      failed: 0,
    });
  });

  it("section baru dari token DI muncul tanpa mengubah service", async () => {
    // Service menerima array section apa adanya: menambah implementasi
    // DashboardSection + pendaftaran token (lihat dashboard.module.ts)
    // cukup membuat kartunya tampil — tanpa cabang baru di service.
    const { service } = await loadService([
      section("users", "User Aplikasi", 1),
      section("cbt_questions", "Soal CBT", 25, "25 soal aktif"),
    ]);

    const result = await service.appDashboard(ctx(), APP_DB);

    expect(result.sections.map((item) => item.key)).toEqual([
      "users",
      "cbt_questions",
    ]);
    expect(result.sections[1]).toMatchObject({
      label: "Soal CBT",
      value: 25,
    });
  });

  it("satu section gagal tak meruntuhkan section lain", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const broken: DashboardSection = {
        key: "rusak",
        label: "Modul Rusak",
        resolve: jest.fn().mockRejectedValue(new Error("bug penyumbang")),
      };
      const { service } = await loadService([
        section("users", "User Aplikasi", 12),
        broken,
      ]);

      const result = await service.appDashboard(ctx(), APP_DB);

      expect(result.sections).toEqual([
        {
          key: "users",
          label: "User Aplikasi",
          value: 12,
          hint: null,
        },
        {
          key: "rusak",
          label: "Modul Rusak",
          value: 0,
          hint: "Data tidak tersedia",
        },
      ]);
    } finally {
      error.mockRestore();
    }
  });
});
