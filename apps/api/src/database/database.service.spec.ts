import type { ConfigService } from "@nestjs/config";
import { DatabaseService } from "./database.service";

function makeService(): DatabaseService {
  const config = {
    getOrThrow: (key: string): string => {
      if (key === "CONTROL_PLANE_DB_URL") {
        // Pool tidak konek saat konstruksi; URL dummy aman untuk tes ini.
        return "postgres://localhost:5432/dummy_tidak_terpakai";
      }
      throw new Error(`unexpected key: ${key}`);
    },
  } as unknown as ConfigService;
  return new DatabaseService(config);
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
});
