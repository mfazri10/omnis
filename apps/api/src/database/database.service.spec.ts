import type { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import {
  AppNotFoundException,
  AppSuspendedException,
} from "../common/exceptions/app.exceptions";
import { DatabaseService } from "./database.service";

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    end: jest.fn(),
  })),
}));

function makeService(): DatabaseService {
  const config = {
    getOrThrow: (key: string): string => {
      if (
        key === "CONTROL_PLANE_DB_URL" ||
        key === "POSTGRES_BASE_URL"
      ) {
        // Pool tidak konek saat konstruksi; URL dummy aman untuk tes ini.
        return "postgres://localhost:5432/dummy_tidak_terpakai";
      }
      throw new Error(`unexpected key: ${key}`);
    },
  } as unknown as ConfigService;
  return new DatabaseService(config);
}

function stubControlPlane(
  service: DatabaseService,
  rows: Array<{ id: number; status: string }>,
): jest.Mock {
  const execute = jest.fn().mockResolvedValue({ rows });
  jest
    .spyOn(service, "getControlPlaneConnection")
    .mockReturnValue({ execute } as never);
  return execute;
}

describe("DatabaseService", () => {
  it("lazy: koneksi control-plane tersedia tanpa onModuleInit (dipakai factory AUTH)", async () => {
    const service = makeService();
    try {
      const db = service.getControlPlaneConnection();
      expect(db).toBeDefined();
      expect(typeof db.select).toBe("function");
    } finally {
      await service.onModuleDestroy();
    }
  });

  it("mengembalikan instance koneksi yang sama pada pemanggilan berulang", async () => {
    const service = makeService();
    try {
      expect(service.getControlPlaneConnection()).toBe(
        service.getControlPlaneConnection(),
      );
    } finally {
      await service.onModuleDestroy();
    }
  });

  it("getAppConnection menolak slug fiktif", async () => {
    const service = makeService();
    try {
      stubControlPlane(service, []);
      await expect(service.getAppConnection("asing")).rejects.toBeInstanceOf(
        AppNotFoundException,
      );
    } finally {
      await service.onModuleDestroy();
    }
  });

  it("getAppConnection default menolak non-active", async () => {
    const service = makeService();
    try {
      stubControlPlane(service, [{ id: 7, status: "suspended" }]);
      await expect(
        service.getAppConnection("tes-cpns"),
      ).rejects.toBeInstanceOf(AppSuspendedException);
    } finally {
      await service.onModuleDestroy();
    }
  });

  it("getAppConnection allowNonActive meloloskan suspended (akses milik guard)", async () => {
    const service = makeService();
    try {
      const execute = stubControlPlane(service, [
        { id: 7, status: "suspended" },
      ]);
      const db = await service.getAppConnection("tes-cpns", {
        allowNonActive: true,
      });
      expect(db).toBeDefined();
      expect(execute).toHaveBeenCalled();
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: expect.stringContaining(
            "/app_tes_cpns",
          ) as unknown,
        }),
      );
    } finally {
      await service.onModuleDestroy();
    }
  });
});
