import {
  BadRequestException,
  ConflictException,
  RequestTimeoutException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { DatabaseService } from "../../../database/database.service";
import { migrateUp } from "../../../database/migration/migration-runner";
import type { AppRow } from "../entities/apps.entity";
import type { AppConfigsRepository } from "./app-configs.repository";
import type { AppsRepository } from "./apps.repository";
import type { AppsService } from "./apps.service";
import { ProvisioningService } from "./provisioning.service";

jest.mock("../../../database/migration/migration-runner", () => ({
  migrateUp: jest.fn(),
}));

const mockMigrateUp = migrateUp as unknown as jest.Mock;

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeService(options: { timeoutMs?: number; lockAcquired?: boolean } = {}): {
  service: ProvisioningService;
  database: Mocked<DatabaseService>;
  apps: Mocked<AppsRepository>;
  configs: Mocked<AppConfigsRepository>;
  appService: Mocked<AppsService>;
} {
  const acquired = options.lockAcquired ?? true;
  const lockClient = {
    query: jest.fn().mockResolvedValue({ rows: [{ acquired }] }),
  };
  const database: Mocked<DatabaseService> = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    getControlPlaneConnection: jest.fn().mockReturnValue({}),
    withControlPlaneClient: jest
      .fn()
      .mockImplementation(async (fn: (client: unknown) => Promise<unknown>) =>
        fn(lockClient),
      ),
    databaseExists: jest.fn(),
    createDatabase: jest.fn(),
    dropDatabaseIfExists: jest.fn(),
    withAppDbConnection: jest
      .fn()
      .mockImplementation(
        async (_dbName: string, fn: (db: unknown) => Promise<unknown>) =>
          fn({}),
      ),
    closeAppPool: jest.fn(),
    getAppConnection: jest.fn(),
    getPoolMetrics: jest.fn(),
  };
  const apps: Mocked<AppsRepository> = {
    findById: jest.fn(),
    findBySlug: jest.fn(),
    listActive: jest.fn(),
    findByIds: jest.fn(),
    insert: jest.fn(),
    list: jest.fn(),
    updateById: jest.fn(),
    deleteById: jest.fn(),
    activateIfProvisioning: jest.fn().mockResolvedValue(true),
  };
  const configs: Mocked<AppConfigsRepository> = {
    insertDefault: jest.fn(),
    deleteByAppId: jest.fn(),
  };
  const appService: Mocked<AppsService> = {
    listAccessibleApps: jest.fn(),
    listApps: jest.fn(),
    findBySlugDetailed: jest.fn().mockResolvedValue({ id: "1" }),
    updateApp: jest.fn(),
    suspendApp: jest.fn(),
    unsuspendApp: jest.fn(),
    archiveApp: jest.fn(),
    deleteApp: jest.fn(),
    setFcmCredential: jest.fn(),
  };
  const config = {
    get: jest.fn().mockReturnValue(options.timeoutMs ?? 30000),
  } as unknown as ConfigService;
  const service = new ProvisioningService(
    database as unknown as DatabaseService,
    apps,
    configs,
    appService as unknown as AppsService,
    config,
  );
  return { service, database, apps, configs, appService };
}

function appRow(over: Record<string, unknown> = {}): AppRow {
  return {
    id: 1,
    name: "Uji",
    slug: "uji-x",
    iconMediaUrl: null,
    status: "provisioning",
    dbName: "app_uji_x",
    androidPackage: null,
    iosBundleId: null,
    storeUrlAndroid: null,
    storeUrlIos: null,
    fcmCredential: null,
    notes: null,
    failureReason: null,
    lastProvisioningAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

beforeEach(() => {
  mockMigrateUp.mockReset();
});

describe("ProvisioningService", () => {
  it("sukses menjalankan step berurutan + return fresh active", async () => {
    const { service, database, apps, configs, appService } = makeService();
    const order: string[] = [];
    apps.findBySlug.mockResolvedValue(null);
    apps.insert.mockImplementation(() => {
      order.push("insert");
      return Promise.resolve(appRow());
    });
    database.createDatabase.mockImplementation(() => {
      order.push("createDb");
      return Promise.resolve();
    });
    database.withAppDbConnection.mockImplementation((_db, fn: (db: unknown) => Promise<unknown>) => {
      order.push("migrate");
      return fn({});
    });
    mockMigrateUp.mockResolvedValue(["m1"]);
    configs.insertDefault.mockImplementation(() => {
      order.push("config");
      return Promise.resolve();
    });
    apps.activateIfProvisioning.mockImplementation(() => {
      order.push("activate");
      return Promise.resolve(true);
    });
    appService.findBySlugDetailed.mockResolvedValue({ id: "1" });
    const result = await service.provisionApp({ name: "Uji", slug: "uji-x" });
    expect(order).toEqual(["insert", "createDb", "migrate", "config", "activate"]);
    expect(result).toEqual({ id: "1" });
  });

  it("migrasi gagal → DROP DB + tandai failed + lempar asli", async () => {
    const { service, database, apps } = makeService();
    apps.findBySlug.mockResolvedValue(null);
    apps.insert.mockResolvedValue(appRow());
    mockMigrateUp.mockRejectedValue(new Error("migasi rusak"));
    await expect(
      service.provisionApp({ name: "X", slug: "uji-x" }),
    ).rejects.toThrow("migasi rusak");
    expect(database.dropDatabaseIfExists).toHaveBeenCalledWith("app_uji_x");
    expect(apps.updateById).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("kompensasi gagal ikut dicatat di reason", async () => {
    const { service, database, apps } = makeService();
    apps.findBySlug.mockResolvedValue(null);
    apps.insert.mockResolvedValue(appRow());
    mockMigrateUp.mockRejectedValue(new Error("migasi rusak"));
    database.dropDatabaseIfExists.mockRejectedValue(new Error("drop macet"));
    const patches: Array<Record<string, unknown>> = [];
    apps.updateById.mockImplementation(
      (_db: unknown, _id: number, patch: Record<string, unknown>) => {
        patches.push(patch);
        return Promise.resolve();
      },
    );
    await expect(
      service.provisionApp({ name: "X", slug: "uji-x" }),
    ).rejects.toThrow("migasi rusak");
    expect(patches[0]?.failureReason).toMatch("Kompensasi gagal");
    expect(patches[0]?.failureReason).toMatch("migasi rusak");
  });

  it("lock gagal → Conflict tanpa side effect", async () => {
    const { service, apps, database } = makeService({ lockAcquired: false });
    await expect(
      service.provisionApp({ name: "X", slug: "uji-x" }),
    ).rejects.toThrow(ConflictException);
    expect(apps.insert).not.toHaveBeenCalled();
    expect(database.createDatabase).not.toHaveBeenCalled();
  });

  it("slug 2 karakter ditolak (minimal 3)", async () => {
    const { service } = makeService();
    await expect(
      service.provisionApp({ name: "X", slug: "ab" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("slug 60 karakter ditolak (dbName > 63); 59 lolos validasi", async () => {
    const { service, apps } = makeService();
    await expect(
      service.provisionApp({ name: "X", slug: "a".repeat(60) }),
    ).rejects.toThrow("terlalu panjang");
    expect(apps.insert).not.toHaveBeenCalled();
    apps.findBySlug.mockResolvedValue(null);
    apps.insert.mockResolvedValue(appRow());
    apps.activateIfProvisioning.mockResolvedValue(true);
    await expect(
      service.provisionApp({ name: "X", slug: "a".repeat(59) }),
    ).resolves.toBeDefined();
  });

  it("slug format salah + modules non-kosong ditolak", async () => {
    const { service } = makeService();
    await expect(
      service.provisionApp({ name: "X", slug: "Slug Salah!" }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.provisionApp({ name: "X", slug: "uji-x", modules: ["cbt"] }),
    ).rejects.toThrow("Fase 2");
  });

  it("retry suspended → BadRequest", async () => {
    const { service, apps } = makeService();
    apps.findBySlug.mockResolvedValue(appRow({ status: "suspended" }));
    await expect(service.retryProvisionApp("uji-x")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("retry active → BadRequest; retry failed jalan", async () => {
    const { service, apps } = makeService();
    apps.findBySlug.mockResolvedValue(appRow({ status: "active" }));
    await expect(service.retryProvisionApp("uji-x")).rejects.toThrow(
      BadRequestException,
    );
    apps.findBySlug.mockResolvedValue(appRow({ status: "failed" }));
    mockMigrateUp.mockResolvedValue([]);
    await expect(service.retryProvisionApp("uji-x")).resolves.toBeDefined();
  });

  it("aktivasi kalah balapan → timeout + kompensasi", async () => {
    const { service, apps, database } = makeService();
    apps.findBySlug.mockResolvedValue(null);
    apps.insert.mockResolvedValue(appRow());
    apps.activateIfProvisioning.mockResolvedValue(false);
    await expect(
      service.provisionApp({ name: "X", slug: "uji-x" }),
    ).rejects.toThrow(RequestTimeoutException);
    expect(database.dropDatabaseIfExists).toHaveBeenCalledWith("app_uji_x");
    expect(apps.updateById).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("timeout → RequestTimeout + failed", async () => {
    const { service, apps, database } = makeService({ timeoutMs: 5 });
    apps.findBySlug.mockResolvedValue(null);
    apps.insert.mockResolvedValue(appRow());
    database.withAppDbConnection.mockImplementation(
      () => new Promise<never>(() => undefined),
    );
    await expect(
      service.provisionApp({ name: "X", slug: "uji-x" }),
    ).rejects.toThrow(RequestTimeoutException);
    expect(apps.updateById).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ status: "failed" }),
    );
  }, 10000);
});
