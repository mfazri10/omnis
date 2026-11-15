import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { Db } from "../../../database/database.service";
import type { DatabaseService } from "../../../database/database.service";
import type { AppsRepository } from "../apps/apps.repository";
import type { AppRow } from "../entities/apps.entity";
import type { RoleRow } from "../entities/roles.entity";
import type { PermissionsRepository } from "./permissions.repository";
import { RolesService } from "./roles.service";
import type { AssignmentsRepository } from "./assignments.repository";

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeService(): {
  service: RolesService;
  roles: Mocked<import("./roles.repository").RolesRepository>;
  permissions: Mocked<PermissionsRepository>;
  apps: Mocked<AppsRepository>;
  assignments: Mocked<AssignmentsRepository>;
} {
  const roles: Mocked<import("./roles.repository").RolesRepository> = {
    insert: jest.fn(),
    findById: jest.fn(),
    findByNameInScope: jest.fn().mockResolvedValue(null),
    list: jest.fn(),
    updateById: jest.fn(),
    deleteById: jest.fn(),
    findRolePermissionKeys: jest.fn().mockResolvedValue([]),
    replaceRolePermissions: jest.fn(),
  };
  const permissions: Mocked<PermissionsRepository> = {
    findByKey: jest.fn(),
    insert: jest.fn(),
    updateByKey: jest.fn(),
    listByModule: jest.fn(),
  };
  const apps: Mocked<AppsRepository> = {
    findById: jest.fn(),
    findBySlug: jest.fn(),
    listActive: jest.fn(),
  };
  const assignments: Mocked<AssignmentsRepository> = {
    insert: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    listAdminIdsByRole: jest.fn().mockResolvedValue([]),
    listByAdmin: jest.fn(),
  };
  const database = {
    getControlPlaneConnection: jest.fn().mockReturnValue({} as Db),
  } as unknown as DatabaseService;
  const service = new RolesService(
    database,
    roles as unknown as import("./roles.repository").RolesRepository,
    permissions as unknown as PermissionsRepository,
    apps as unknown as AppsRepository,
    assignments as unknown as AssignmentsRepository,
  );
  return { service, roles, permissions, apps, assignments };
}

function roleRow(over: Partial<RoleRow> = {}): RoleRow {
  return {
    id: 7,
    name: "Editor Soal",
    description: null,
    scopeType: "app",
    appId: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

describe("RolesService", () => {
  it("membuat role app valid beserta permission-nya", async () => {
    const { service, roles, permissions, apps } = makeService();
    apps.findById.mockResolvedValue(appRow());
    permissions.findByKey.mockResolvedValue({ id: 3 });
    roles.insert.mockResolvedValue(roleRow());
    roles.findRolePermissionKeys.mockResolvedValue(["platform.users.view"]);
    const detail = await service.create({
      name: "Editor Soal",
      scopeType: "app",
      appId: "1",
      permissionKeys: ["platform.users.view"],
    });
    expect(detail).toMatchObject({
      id: "7",
      name: "Editor Soal",
      scopeType: "app",
      appId: "1",
      permissionKeys: ["platform.users.view"],
    });
    expect(roles.replaceRolePermissions).toHaveBeenCalled();
  });

  it("menolak role app tanpa appId", async () => {
    const { service } = makeService();
    await expect(
      service.create({ name: "X", scopeType: "app", permissionKeys: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it("menolak appId pada role global", async () => {
    const { service } = makeService();
    await expect(
      service.create({
        name: "X",
        scopeType: "global",
        appId: "1",
        permissionKeys: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("menolak permission sensitif pada role cakupan-app", async () => {
    const { service, apps, permissions } = makeService();
    apps.findById.mockResolvedValue(appRow());
    permissions.findByKey.mockResolvedValue({ id: 1 });
    await expect(
      service.create({
        name: "X",
        scopeType: "app",
        appId: "1",
        permissionKeys: ["platform.roles.manage"],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("menolak kunci permission tak dikenal", async () => {
    const { service, permissions } = makeService();
    permissions.findByKey.mockResolvedValue(null);
    await expect(
      service.create({
        name: "X",
        scopeType: "global",
        permissionKeys: ["tidak.ada.x"],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("menolak nama duplikat dalam konteks sama", async () => {
    const { service, roles } = makeService();
    roles.findByNameInScope.mockResolvedValue(roleRow());
    await expect(
      service.create({ name: "Editor Soal", scopeType: "global", permissionKeys: [] }),
    ).rejects.toThrow(ConflictException);
  });

  it("menolak hapus role yang masih dipakai penetapan", async () => {
    const { service, roles, assignments } = makeService();
    roles.findById.mockResolvedValue(roleRow());
    assignments.listAdminIdsByRole.mockResolvedValue([11, 12]);
    await expect(service.remove("7")).rejects.toThrow(
      "masih dipakai 2 penetapan",
    );
    expect(roles.deleteById).not.toHaveBeenCalled();
  });

  it("findById tak ada → NotFound", async () => {
    const { service, roles } = makeService();
    roles.findById.mockResolvedValue(null);
    await expect(service.findById("99")).rejects.toThrow(NotFoundException);
  });
});
