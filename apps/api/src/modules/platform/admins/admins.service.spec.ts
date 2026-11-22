import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseService } from "../../../database/database.service";
import type { SessionRepository } from "../../../auth/session.repository";
import type { AppRow } from "../entities/apps.entity";
import type { AdminRow } from "../entities/admins.entity";
import type { RbacService } from "../rbac/rbac.service";
import type { AppsRepository } from "../apps/apps.repository";
import {
  AppSuspendedException,
} from "../../../common/exceptions/app.exceptions";
import { AdminsService } from "./admins.service";
import type { AdminsRepository } from "./admins.repository";

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeService(): {
  service: AdminsService;
  admins: Mocked<AdminsRepository>;
  sessions: Mocked<SessionRepository>;
  rbac: Mocked<RbacService>;
  apps: Mocked<AppsRepository>;
} {
  const admins: Mocked<AdminsRepository> = {
    findByAuthUserId: jest.fn(),
    findByEmail: jest.fn(),
    createProfile: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
    updateName: jest.fn(),
    setActive: jest.fn(),
    countActiveSuperAdmins: jest.fn(),
  };
  const sessions: Mocked<SessionRepository> = {
    deleteByUserId: jest.fn(),
  };
  const rbac: Mocked<RbacService> = {
    hasPermission: jest.fn(),
    listEffectivePermissions: jest.fn(),
    bumpAdminVersion: jest.fn(),
  };
  const database = {
    getControlPlaneConnection: jest.fn().mockReturnValue({}),
  } as unknown as DatabaseService;
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
  const service = new AdminsService(
    database,
    admins,
    sessions,
    rbac as unknown as RbacService,
    apps,
  );
  return { service, admins, sessions, rbac, apps };
}

function adminRow(over: Partial<AdminRow> = {}): AdminRow {
  return {
    id: 11,
    authUserId: "u11",
    name: "Operator",
    email: "op@contoh.id",
    isSuperAdmin: false,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

describe("AdminsService", () => {
  it("list meneruskan search/skip/take + memetakan hasil", async () => {
    const { service, admins } = makeService();
    admins.list.mockResolvedValue({ rows: [adminRow()], total: 1 });
    const result = await service.listAdmins({
      search: "op",
      skip: 0,
      take: 20,
    });
    expect(admins.list).toHaveBeenCalledWith(expect.anything(), {
      search: "op",
      skip: 0,
      take: 20,
    });
    expect(result.totalCount).toBe(1);
    expect(result.items[0]).toMatchObject({ id: "11", isActive: true });
  });

  it("menolak menonaktifkan Super Admin aktif terakhir", async () => {
    const { service, admins, sessions, rbac } = makeService();
    admins.findById.mockResolvedValue(
      adminRow({ id: 1, isSuperAdmin: true }),
    );
    admins.countActiveSuperAdmins.mockResolvedValue(1);
    await expect(service.setAdminActive("1", false)).rejects.toThrow(
      "Super Admin aktif terakhir",
    );
    expect(sessions.deleteByUserId).not.toHaveBeenCalled();
    expect(rbac.bumpAdminVersion).not.toHaveBeenCalled();
  });

  it("nonaktif biasa mencabut sesi + bump cache", async () => {
    const { service, admins, sessions, rbac } = makeService();
    admins.findById.mockResolvedValue(adminRow());
    await service.setAdminActive("11", false);
    expect(admins.setActive).toHaveBeenCalledWith(expect.anything(), 11, false);
    expect(sessions.deleteByUserId).toHaveBeenCalledWith(
      expect.anything(),
      "u11",
    );
    expect(rbac.bumpAdminVersion).toHaveBeenCalledWith(["11"]);
  });

  it("aktifkan kembali tanpa mencabut sesi", async () => {
    const { service, admins, sessions } = makeService();
    admins.findById.mockResolvedValue(adminRow({ isActive: false }));
    const result = await service.setAdminActive("11", true);
    expect(result.isActive).toBe(true);
    expect(sessions.deleteByUserId).not.toHaveBeenCalled();
  });

  it("updateAdmin mengubah nama", async () => {
    const { service, admins } = makeService();
    admins.findById.mockResolvedValue(adminRow());
    const result = await service.updateAdmin("11", { name: "Baru" });
    expect(admins.updateName).toHaveBeenCalledWith(expect.anything(), 11, "Baru");
    expect(result.name).toBe("Baru");
  });

  it("admin tak ada → NotFound", async () => {
    const { service, admins } = makeService();
    admins.findById.mockResolvedValue(null);
    await expect(service.setAdminActive("99", false)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.updateAdmin("99", { name: "X" })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("findById mengembalikan item + NotFound bila tak ada", async () => {
    const { service, admins } = makeService();
    admins.findById.mockResolvedValue(adminRow());
    const found = await service.findById("11");
    expect(found).toMatchObject({ id: "11", isActive: true });
    admins.findById.mockResolvedValue(null);
    await expect(service.findById("99")).rejects.toThrow(NotFoundException);
  });

  it("listOwnPermissions tanpa appId → teruskan global", async () => {
    const { service, rbac } = makeService();
    rbac.listEffectivePermissions.mockResolvedValue(["platform.apps.view"]);
    const result = await service.listOwnPermissions({
      id: "11",
      isSuperAdmin: false,
    });
    expect(rbac.listEffectivePermissions).toHaveBeenCalledWith("11", undefined);
    expect(result).toEqual(["platform.apps.view"]);
  });

  it("listOwnPermissions appId fiktif → NotFound", async () => {
    const { service, apps } = makeService();
    apps.findById.mockResolvedValue(null);
    await expect(
      service.listOwnPermissions({ id: "11", isSuperAdmin: false }, "99"),
    ).rejects.toThrow(NotFoundException);
  });

  it("listOwnPermissions appId korup → BadRequest", async () => {
    const { service } = makeService();
    await expect(
      service.listOwnPermissions({ id: "11", isSuperAdmin: false }, "x"),
    ).rejects.toThrow(BadRequestException);
  });

  it("listOwnPermissions non-super + suspended → AppSuspended", async () => {
    const { service, apps } = makeService();
    apps.findById.mockResolvedValue(appRow({ status: "suspended" }));
    await expect(
      service.listOwnPermissions({ id: "11", isSuperAdmin: false }, "7"),
    ).rejects.toBeInstanceOf(AppSuspendedException);
  });

  it("listOwnPermissions super + suspended → teruskan", async () => {
    const { service, apps, rbac } = makeService();
    apps.findById.mockResolvedValue(appRow({ status: "suspended" }));
    rbac.listEffectivePermissions.mockResolvedValue([]);
    const result = await service.listOwnPermissions(
      { id: "11", isSuperAdmin: true },
      "7",
    );
    expect(rbac.listEffectivePermissions).toHaveBeenCalledWith("11", "7");
    expect(result).toEqual([]);
  });
});

function appRow(over: Partial<AppRow> = {}): AppRow {
  return {
    id: 7,
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
