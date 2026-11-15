import type { DatabaseService } from "../../../database/database.service";
import type { PermissionRow } from "../entities/permissions.entity";
import { PermissionsService } from "./permissions.service";
import type { PermissionsRepository } from "./permissions.repository";
import {
  PLATFORM_CATALOG,
  isSensitivePermission,
} from "./platform.permissions";

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeService(): {
  service: PermissionsService;
  repo: Mocked<PermissionsRepository>;
} {
  const full: Mocked<PermissionsRepository> = {
    findByKey: jest.fn(),
    insert: jest.fn(),
    updateByKey: jest.fn(),
    listByModule: jest.fn(),
  };
  const database = {
    getControlPlaneConnection: jest.fn().mockReturnValue({}),
  } as unknown as DatabaseService;
  const service = new PermissionsService(
    database,
    full,
  );
  return { service, repo: full };
}

function rowOf(key: string, label: string): PermissionRow {
  return {
    id: 1,
    key,
    module: "platform",
    label,
    description: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("PermissionsService", () => {
  it("menyisipkan yang hilang, memperbarui label berubah, melewati yang sama", async () => {
    const { service, repo } = makeService();
    repo.findByKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(rowOf("c.d", "Label Lama"))
      .mockResolvedValueOnce(rowOf("e.f", "Label Sama"));
    const result = await service.syncCatalog([
      { key: "a.b", module: "platform", label: "Baru", globalOnly: false },
      { key: "c.d", module: "platform", label: "Label Baru", globalOnly: false },
      { key: "e.f", module: "platform", label: "Label Sama", globalOnly: false },
    ]);
    expect(result).toEqual({ inserted: 1, updated: 1 });
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.updateByKey).toHaveBeenCalledTimes(1);
  });

  it("listByModule meneruskan filter modul", async () => {
    const { service, repo } = makeService();
    repo.listByModule.mockResolvedValue([rowOf("platform.users.view", "X")]);
    const rows = await service.listByModule("platform");
    expect(repo.listByModule).toHaveBeenCalledWith(expect.anything(), "platform");
    expect(rows).toHaveLength(1);
  });
});

describe("PLATFORM_CATALOG", () => {
  it("16 kunci unik, format modul.entitas.aksi, tanpa wildcard", () => {
    const keys = PLATFORM_CATALOG.map((d) => d.key);
    expect(keys).toHaveLength(16);
    expect(new Set(keys).size).toBe(16);
    for (const key of keys) {
      expect(key).toMatch(/^[a-z]+\.[a-z-]+\.[a-z]+$/);
    }
  });

  it("globalOnly konsisten dengan aturan sensitif", () => {
    for (const def of PLATFORM_CATALOG) {
      expect(def.globalOnly).toBe(isSensitivePermission(def.key));
    }
  });

  it("isSensitivePermission hanya untuk platform.apps/roles/admins", () => {
    expect(isSensitivePermission("platform.roles.manage")).toBe(true);
    expect(isSensitivePermission("platform.apps.view")).toBe(true);
    expect(isSensitivePermission("platform.users.view")).toBe(false);
    expect(isSensitivePermission("platform.audit.view")).toBe(false);
    expect(isSensitivePermission("cbt.questions.view")).toBe(false);
  });
});
