import { BadRequestException } from "@nestjs/common";
import { Pool } from "pg";
import type { ConfigService } from "@nestjs/config";
import { DatabaseService } from "./database.service";

jest.mock("pg", () => {
  const actual = jest.requireActual<Record<string, unknown>>("pg");
  return { ...actual, Pool: jest.fn() };
});

const MockPool = Pool as unknown as jest.Mock;

interface FakePool {
  query: jest.Mock;
  connect: jest.Mock;
  end: jest.Mock;
  client: { query: jest.Mock; release: jest.Mock };
}

function makeService(): { service: DatabaseService; pools: FakePool[] } {
  const pools: FakePool[] = [];
  MockPool.mockImplementation(() => {
    const client = { query: jest.fn(), release: jest.fn() };
    const pool: FakePool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(client),
      end: jest.fn(),
      client,
    };
    pools.push(pool);
    return pool;
  });
  const config = {
    getOrThrow: (key: string): string => {
      if (key === "CONTROL_PLANE_DB_URL") {
        return "postgres://localhost:5432/platform";
      }
      if (key === "POSTGRES_BASE_URL") {
        return "postgres://localhost:5432";
      }
      throw new Error(`unexpected key: ${key}`);
    },
  } as unknown as ConfigService;
  return { service: new DatabaseService(config), pools };
}

beforeEach(() => {
  MockPool.mockClear();
});

describe("DatabaseService operasi admin", () => {
  it("createDatabase mengirim CREATE DATABASE ter-quote + menutup pool", async () => {
    const { service, pools } = makeService();
    await service.createDatabase("app_uji_x");
    expect(pools).toHaveLength(1);
    expect(pools[0]?.query).toHaveBeenCalledWith(
      'CREATE DATABASE "app_uji_x"',
    );
    expect(pools[0]?.end).toHaveBeenCalled();
  });

  it("dropDatabaseIfExists terminate-backend lalu DROP", async () => {
    const { service, pools } = makeService();
    await service.dropDatabaseIfExists("app_uji_x");
    const calls = pools[0]?.query.mock.calls as Array<[string]>;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0]).toMatch(/pg_terminate_backend/);
    expect(calls[0]?.[0]).toMatch(/pid <> pg_backend_pid\(\)/);
    expect(calls[1]?.[0]).toBe('DROP DATABASE IF EXISTS "app_uji_x"');
    expect(pools[0]?.end).toHaveBeenCalled();
  });

  it("menolak nama database di luar allowlist tanpa query", async () => {
    const { service } = makeService();
    await expect(
      service.createDatabase('x"; DROP TABLE apps; --'),
    ).rejects.toThrow(BadRequestException);
    expect(MockPool).not.toHaveBeenCalled();
  });

  it("databaseExists membaca pg_database berparameter", async () => {
    const { service, pools } = makeService();
    const query = jest.fn().mockResolvedValue({ rows: [{ one: 1 }] });
    MockPool.mockImplementationOnce(() => {
      const pool = {
        query,
        connect: jest.fn(),
        end: jest.fn(),
        client: { query: jest.fn(), release: jest.fn() },
      };
      pools.push(pool);
      return pool;
    });
    await expect(service.databaseExists("app_x")).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("FROM pg_database"),
      ["app_x"],
    );
  });

  it("withControlPlaneClient me-release koneksi", async () => {
    const { service, pools } = makeService();
    const seen: unknown[] = [];
    await service.withControlPlaneClient((client) => {
      seen.push(client);
      return Promise.resolve();
    });
    expect(pools).toHaveLength(1);
    expect(pools[0]?.connect).toHaveBeenCalled();
    expect(pools[0]?.client.release).toHaveBeenCalled();
    expect(seen[0]).toBe(pools[0]?.client);
  });

  it("closeAppPool slug tak dikenal → false", async () => {
    const { service } = makeService();
    await expect(service.closeAppPool("tak-ada")).resolves.toBe(false);
  });
});
