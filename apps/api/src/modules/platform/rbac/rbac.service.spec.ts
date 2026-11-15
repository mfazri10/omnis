import type { DatabaseService } from "../../../database/database.service";
import type { RedisService } from "../../../redis/redis.service";
import type { PermissionRow } from "../entities/permissions.entity";
import type { AssignmentsRepository } from "./assignments.repository";
import type { AssignmentRow } from "./assignments.repository";
import type { PermissionsRepository } from "./permissions.repository";
import { RbacService } from "./rbac.service";
import type { RolesRepository } from "./roles.repository";

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeRedis(): {
  client: Record<string, jest.Mock>;
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  const client: Record<string, jest.Mock> = {
    get: jest.fn((key: string): Promise<string | null> => {
      const value = store.get(key);
      return Promise.resolve(value === undefined ? null : value);
    }),
    setex: jest.fn((key: string, _ttl: number, value: string): Promise<void> => {
      store.set(key, value);
      return Promise.resolve();
    }),
    incr: jest.fn((key: string): Promise<number> => {
      const next = Number(store.get(key) ?? "0") + 1;
      store.set(key, String(next));
      return Promise.resolve(next);
    }),
    expire: jest.fn((): Promise<number> => Promise.resolve(1)),
  };
  return { client, store };
}

function makeService(): {
  service: RbacService;
  assignments: Mocked<AssignmentsRepository>;
  roles: Mocked<RolesRepository>;
  permissions: Mocked<PermissionsRepository>;
  redis: Record<string, jest.Mock>;
} {
  const assignments: Mocked<AssignmentsRepository> = {
    insert: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    listAdminIdsByRole: jest.fn(),
    listByAdmin: jest.fn(),
    listDetailedByAdmin: jest.fn(),
  };
  const roles: Mocked<RolesRepository> = {
    insert: jest.fn(),
    findById: jest.fn(),
    findByNameInScope: jest.fn(),
    list: jest.fn(),
    updateById: jest.fn(),
    deleteById: jest.fn(),
    findRolePermissionKeys: jest.fn(),
    replaceRolePermissions: jest.fn(),
  };
  const permissions: Mocked<PermissionsRepository> = {
    findByKey: jest.fn(),
    insert: jest.fn(),
    updateByKey: jest.fn(),
    listByModule: jest.fn(),
  };
  const { client } = makeRedis();
  const database = {
    getControlPlaneConnection: jest.fn().mockReturnValue({}),
  } as unknown as DatabaseService;
  const redis = {
    getClient: jest.fn().mockReturnValue(client as unknown),
  } as unknown as RedisService;
  const service = new RbacService(
    database,
    assignments as unknown as AssignmentsRepository,
    roles,
    permissions,
    redis,
  );
  return { service, assignments, roles, permissions, redis: client };
}

function permRow(key: string): PermissionRow {
  return {
    id: 1,
    key,
    module: key.split(".")[0] ?? "",
    label: key,
    description: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function globalGrant(roleId: number): AssignmentRow {
  return { roleId, appId: null, scopeType: "global", roleAppId: null };
}

function appGrant(roleId: number, appId: number): AssignmentRow {
  return { roleId, appId, scopeType: "app", roleAppId: appId };
}

/** Memasang held-keys + katalog agar hasPermission bisa dievaluasi. */
function grantKeys(
  ctx: ReturnType<typeof makeService>,
  grants: AssignmentRow[],
  heldByRole: Record<number, string[]>,
  catalogKeys: string[],
): void {
  ctx.assignments.listByAdmin.mockResolvedValue(grants);
  ctx.roles.findRolePermissionKeys.mockImplementation(
    (_db: unknown, roleId: number): Promise<string[]> =>
      Promise.resolve(heldByRole[roleId] ?? []),
  );
  ctx.permissions.listByModule.mockResolvedValue(
    catalogKeys.map((key) => permRow(key)),
  );
}

describe("RbacService.hasPermission", () => {
  it("manage mencakup aksi se-entitas", async () => {
    const ctx = makeService();
    grantKeys(ctx, [globalGrant(1)], { 1: ["platform.users.manage"] }, [
      "platform.users.view",
      "platform.users.manage",
    ]);
    await expect(
      ctx.service.hasPermission(
        { id: "11", isSuperAdmin: false },
        "platform.users.view",
      ),
    ).resolves.toBe(true);
  });

  it("manage tidak bocor ke entitas lain", async () => {
    const ctx = makeService();
    grantKeys(ctx, [globalGrant(1)], { 1: ["platform.users.manage"] }, [
      "platform.users.view",
      "platform.users.manage",
      "platform.roles.view",
    ]);
    await expect(
      ctx.service.hasPermission(
        { id: "11", isSuperAdmin: false },
        "platform.roles.view",
      ),
    ).resolves.toBe(false);
  });

  it("role global berlaku dalam konteks aplikasi", async () => {
    const ctx = makeService();
    grantKeys(ctx, [globalGrant(1)], { 1: ["platform.users.view"] }, [
      "platform.users.view",
    ]);
    await expect(
      ctx.service.hasPermission(
        { id: "11", isSuperAdmin: false },
        "platform.users.view",
        "2",
      ),
    ).resolves.toBe(true);
  });

  it("role app tidak bocor ke aplikasi lain", async () => {
    const ctx = makeService();
    grantKeys(ctx, [appGrant(1, 1)], { 1: ["platform.users.view"] }, [
      "platform.users.view",
    ]);
    await expect(
      ctx.service.hasPermission(
        { id: "11", isSuperAdmin: false },
        "platform.users.view",
        "2",
      ),
    ).resolves.toBe(false);
  });

  it("super-admin selalu lolos tanpa baca repo", async () => {
    const ctx = makeService();
    await expect(
      ctx.service.hasPermission(
        { id: "1", isSuperAdmin: true },
        "platform.apa.pun",
      ),
    ).resolves.toBe(true);
    expect(ctx.assignments.listByAdmin).not.toHaveBeenCalled();
  });

  it("TIDAK memeriksa status aplikasi (batas F02: AppContextGuard)", async () => {
    const ctx = makeService();
    grantKeys(ctx, [appGrant(1, 9)], { 1: ["platform.users.view"] }, [
      "platform.users.view",
    ]);
    // appId 9 dianggap suspended sekalipun — service ini tetap true.
    await expect(
      ctx.service.hasPermission(
        { id: "11", isSuperAdmin: false },
        "platform.users.view",
        "9",
      ),
    ).resolves.toBe(true);
  });
});

describe("RbacService cache", () => {
  it("panggilan kedua memakai cache; bump membuat hitung ulang", async () => {
    const ctx = makeService();
    grantKeys(ctx, [globalGrant(1)], { 1: ["platform.users.view"] }, [
      "platform.users.view",
    ]);
    const first = await ctx.service.listEffectivePermissions("11");
    expect(first).toEqual(["platform.users.view"]);
    await ctx.service.listEffectivePermissions("11");
    expect(ctx.assignments.listByAdmin).toHaveBeenCalledTimes(1);
    await ctx.service.bumpAdminVersion(["11"]);
    await ctx.service.listEffectivePermissions("11");
    expect(ctx.assignments.listByAdmin).toHaveBeenCalledTimes(2);
  });
});
