import { BadRequestException } from "@nestjs/common";
import type { DatabaseService } from "../../../database/database.service";
import type { AppRow } from "../entities/apps.entity";
import type { AssignmentsRepository } from "../rbac/assignments.repository";
import type { AppConfigsRepository } from "./app-configs.repository";
import { AppsService } from "./apps.service";
import type { AppsRepository } from "./apps.repository";
import type { FcmCredentialService } from "./fcm-credential.service";

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeService(): {
  service: AppsService;
  apps: Mocked<AppsRepository>;
  configs: Mocked<AppConfigsRepository>;
  fcm: Mocked<FcmCredentialService>;
  database: Mocked<DatabaseService>;
  assignments: Mocked<AssignmentsRepository>;
} {
  const apps: Mocked<AppsRepository> = {
    findById: jest.fn(),
    findBySlug: jest.fn(),
    listActive: jest.fn(),
    findByIds: jest.fn(),
    insert: jest.fn(),
    list: jest.fn(),
    updateById: jest.fn(),
    deleteById: jest.fn(),
    activateIfProvisioning: jest.fn(),
  };
  const configs: Mocked<AppConfigsRepository> = {
    insertDefault: jest.fn(),
    deleteByAppId: jest.fn(),
    findByAppId: jest.fn(),
    insertDefaultIfMissing: jest.fn(),
    updateByAppId: jest.fn(),
  };
  const fcm: Mocked<FcmCredentialService> = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };
  const database: Mocked<DatabaseService> = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    getControlPlaneConnection: jest.fn().mockReturnValue({}),
    withControlPlaneClient: jest.fn(),
    databaseExists: jest.fn(),
    createDatabase: jest.fn(),
    dropDatabaseIfExists: jest.fn(),
    withAppDbConnection: jest.fn(),
    closeAppPool: jest.fn(),
    getAppConnection: jest.fn(),
    getPoolMetrics: jest.fn(),
  };
  const assignments: Mocked<AssignmentsRepository> = {
    insert: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    listAdminIdsByRole: jest.fn(),
    listByAdmin: jest.fn(),
    listDetailedByAdmin: jest.fn(),
  };
  const service = new AppsService(
    database as unknown as DatabaseService,
    apps,
    configs,
    fcm as unknown as FcmCredentialService,
    assignments as unknown as AssignmentsRepository,
  );
  return { service, apps, configs, fcm, database, assignments };
}

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
    modules: [],
    failureReason: null,
    lastProvisioningAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

describe("AppsService", () => {
  it("listApps default hanya active; 'all' tanpa filter", async () => {
    const { service, apps } = makeService();
    apps.list.mockResolvedValue([]);
    await service.listApps({});
    expect(apps.list).toHaveBeenCalledWith(expect.anything(), {
      statuses: ["active"],
      search: undefined,
    });
    await service.listApps({ status: "all" });
    expect(apps.list).toHaveBeenCalledWith(expect.anything(), {
      statuses: null,
      search: undefined,
    });
  });

  it("listApps menolak status tak dikenal", async () => {
    const { service } = makeService();
    await expect(service.listApps({ status: "rusak" })).rejects.toThrow(
      "Status tidak valid",
    );
  });

  it("suspend menutup pool; suspend non-active ditolak", async () => {
    const { service, apps, database } = makeService();
    apps.findById.mockResolvedValue(appRow());
    await service.suspendApp("1");
    expect(apps.updateById).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ status: "suspended" }),
    );
    expect(database.closeAppPool).toHaveBeenCalledWith("tes-cpns");
    apps.findById.mockResolvedValue(appRow({ status: "suspended" }));
    await expect(service.suspendApp("1")).rejects.toThrow("Hanya aplikasi aktif");
  });

  it("deleteApp menolak app active tanpa menyentuh DB", async () => {
    const { service, apps, database } = makeService();
    apps.findById.mockResolvedValue(appRow());
    await expect(service.deleteApp("1")).rejects.toThrow(
      "Hanya aplikasi gagal",
    );
    expect(database.dropDatabaseIfExists).not.toHaveBeenCalled();
    expect(apps.deleteById).not.toHaveBeenCalled();
  });

  it("deleteApp suspended → BadRequest", async () => {
    const { service, apps } = makeService();
    apps.findById.mockResolvedValue(appRow({ status: "suspended" }));
    await expect(service.deleteApp("1")).rejects.toThrow(BadRequestException);
  });

  it("deleteApp failed: DROP best-effort + hapus config + hapus baris", async () => {
    const { service, apps, configs, database } = makeService();
    apps.findById.mockResolvedValue(appRow({ status: "failed" }));
    await service.deleteApp("1");
    expect(database.dropDatabaseIfExists).toHaveBeenCalledWith("app_tes_cpns");
    expect(configs.deleteByAppId).toHaveBeenCalled();
    expect(apps.deleteById).toHaveBeenCalled();
  });

  it("setFcmCredential menolak JSON rusak tanpa menyimpan", async () => {
    const { service, apps, fcm } = makeService();
    apps.findById.mockResolvedValue(appRow());
    await expect(service.setFcmCredential("1", "bukan-json")).rejects.toThrow(
      "bukan JSON valid",
    );
    expect(fcm.encrypt).not.toHaveBeenCalled();
  });

  it("setFcmCredential menolak shape tak lengkap", async () => {
    const { service, apps } = makeService();
    apps.findById.mockResolvedValue(appRow());
    await expect(
      service.setFcmCredential("1", JSON.stringify({ project_id: "x" })),
    ).rejects.toThrow("tidak lengkap");
  });

  it("listAccessibleApps super → active + suspended tanpa archived", async () => {
    const { service, apps, assignments } = makeService();
    apps.list.mockResolvedValue([
      appRow({ id: 1, status: "active" }),
      appRow({ id: 2, slug: "warung", status: "suspended" }),
    ]);
    const result = await service.listAccessibleApps({
      id: "11",
      isSuperAdmin: true,
    });
    expect(apps.list).toHaveBeenCalledWith(expect.anything(), {
      statuses: ["active", "suspended"],
    });
    expect(assignments.listByAdmin).not.toHaveBeenCalled();
    expect(result.map((app) => app.slug)).toEqual(["tes-cpns", "warung"]);
  });

  it("listAccessibleApps grant global → semua active", async () => {
    const { service, apps, assignments } = makeService();
    assignments.listByAdmin.mockResolvedValue([
      { roleId: 3, appId: null, scopeType: "global", roleAppId: null },
    ]);
    apps.listActive.mockResolvedValue([appRow()]);
    const result = await service.listAccessibleApps({
      id: "11",
      isSuperAdmin: false,
    });
    expect(assignments.listByAdmin).toHaveBeenCalledWith(
      expect.anything(),
      11,
    );
    expect(result.map((app) => app.slug)).toEqual(["tes-cpns"]);
  });

  it("listAccessibleApps grant 1 app → hanya app itu", async () => {
    const { service, apps, assignments } = makeService();
    assignments.listByAdmin.mockResolvedValue([
      { roleId: 3, appId: 1, scopeType: "app", roleAppId: 1 },
    ]);
    apps.findByIds.mockResolvedValue([
      appRow(),
      appRow({ id: 2, slug: "warung", status: "suspended" }),
    ]);
    const result = await service.listAccessibleApps({
      id: "11",
      isSuperAdmin: false,
    });
    expect(apps.findByIds).toHaveBeenCalledWith(expect.anything(), [1]);
    expect(result.map((app) => app.slug)).toEqual(["tes-cpns"]);
  });

  it("listAccessibleApps tanpa grant → []", async () => {
    const { service, apps, assignments } = makeService();
    assignments.listByAdmin.mockResolvedValue([]);
    const result = await service.listAccessibleApps({
      id: "11",
      isSuperAdmin: false,
    });
    expect(apps.findByIds).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("listAccessibleApps id korup → BadRequest", async () => {
    const { service } = makeService();
    await expect(
      service.listAccessibleApps({ id: "bukan-angka", isSuperAdmin: false }),
    ).rejects.toThrow(BadRequestException);
  });
});
