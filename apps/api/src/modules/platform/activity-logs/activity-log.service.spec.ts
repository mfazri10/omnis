import { BadRequestException } from "@nestjs/common";
import type { DatabaseService } from "../../../database/database.service";
import type {
  ActivityLogListItem,
  ActivityLogsRepository,
} from "./activity-logs.repository";
import { ActivityLogService } from "./activity-log.service";

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeService(): {
  service: ActivityLogService;
  logs: Mocked<ActivityLogsRepository>;
} {
  const logs: Mocked<ActivityLogsRepository> = {
    insert: jest.fn(),
    list: jest.fn(),
    count: jest.fn(),
  };
  const database = {
    getControlPlaneConnection: jest.fn().mockReturnValue({}),
  } as unknown as DatabaseService;
  const service = new ActivityLogService(
    database,
    logs,
  );
  return { service, logs };
}

function listItem(over: Partial<ActivityLogListItem> = {}): ActivityLogListItem {
  return {
    id: 9,
    adminId: 7,
    adminName: "Sari",
    appId: 1,
    appName: "Tes CPNS",
    appSlug: "tes-cpns",
    action: "update",
    entityType: "app_config",
    entityId: "1",
    summary: "Mengubah konfigurasi aplikasi Tes CPNS",
    ipAddress: "203.0.113.7",
    createdAt: new Date("2026-11-17T00:00:00.000Z"),
    ...over,
  };
}

describe("ActivityLogService.record", () => {
  it("memanggil repository dengan payload benar", async () => {
    const { service, logs } = makeService();
    await service.record({
      adminId: "7",
      appId: "1",
      action: "update",
      entityType: "app_config",
      entityId: "1",
      summary: "Mengubah konfigurasi aplikasi Tes CPNS",
      ip: "203.0.113.7",
    });
    expect(logs.insert).toHaveBeenCalledWith(expect.anything(), {
      adminId: 7,
      appId: 1,
      action: "update",
      entityType: "app_config",
      entityId: "1",
      summary: "Mengubah konfigurasi aplikasi Tes CPNS",
      ipAddress: "203.0.113.7",
    });
  });

  it("nilai opsional kosong menjadi null", async () => {
    const { service, logs } = makeService();
    await service.record({
      adminId: "7",
      action: "login",
      summary: "Masuk ke CMS",
    });
    expect(logs.insert).toHaveBeenCalledWith(expect.anything(), {
      adminId: 7,
      appId: null,
      action: "login",
      entityType: null,
      entityId: null,
      summary: "Masuk ke CMS",
      ipAddress: null,
    });
  });

  it("kegagalan repository tidak melempar", async () => {
    const { service, logs } = makeService();
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      logs.insert.mockRejectedValue(new Error("DB putus"));
      await expect(
        service.record({
          adminId: "7",
          action: "login",
          summary: "Masuk ke CMS",
        }),
      ).resolves.toBeUndefined();
      expect(error).toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("adminId tak valid dilewati tanpa melempar", async () => {
    const { service, logs } = makeService();
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        service.record({
          adminId: "bukan-id",
          action: "login",
          summary: "Masuk ke CMS",
        }),
      ).resolves.toBeUndefined();
      expect(logs.insert).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});

describe("ActivityLogService.list", () => {
  it("memetakan filter dan pagination ke repository", async () => {
    const { service, logs } = makeService();
    const from = new Date("2026-11-01T00:00:00.000Z");
    const to = new Date("2026-11-17T00:00:00.000Z");
    logs.list.mockResolvedValue([listItem()]);
    logs.count.mockResolvedValue(1);
    await service.list({
      filter: {
        dateFrom: from,
        dateTo: to,
        appId: "1",
        adminId: "7",
        entityType: "app_config",
        action: "update",
        search: "konfigurasi",
      },
      page: 2,
      perPage: 10,
    });
    expect(logs.list).toHaveBeenCalledWith(
      expect.anything(),
      {
        dateFrom: from,
        dateTo: to,
        appId: 1,
        adminId: 7,
        entityType: "app_config",
        action: "update",
        search: "konfigurasi",
      },
      { limit: 10, offset: 10 },
    );
  });

  it("total dihitung dengan filter yang sama", async () => {
    const { service, logs } = makeService();
    logs.list.mockResolvedValue([listItem()]);
    logs.count.mockResolvedValue(42);
    const result = await service.list({
      filter: { action: "login" },
      page: 1,
      perPage: 20,
    });
    expect(logs.count).toHaveBeenCalledWith(expect.anything(), {
      action: "login",
    });
    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(1);
  });

  it("default halaman 1 dan 20 baris", async () => {
    const { service, logs } = makeService();
    logs.list.mockResolvedValue([]);
    logs.count.mockResolvedValue(0);
    await service.list({});
    expect(logs.list).toHaveBeenCalledWith(
      expect.anything(),
      {},
      { limit: 20, offset: 0 },
    );
  });

  it("perPage dijepit maksimal 100", async () => {
    const { service, logs } = makeService();
    logs.list.mockResolvedValue([]);
    logs.count.mockResolvedValue(0);
    await service.list({ page: 1, perPage: 500 });
    expect(logs.list).toHaveBeenCalledWith(
      expect.anything(),
      {},
      { limit: 100, offset: 0 },
    );
  });

  it("items dipetakan ke id string", async () => {
    const { service, logs } = makeService();
    logs.list.mockResolvedValue([listItem({ appId: null })]);
    logs.count.mockResolvedValue(1);
    const result = await service.list({});
    expect(result.items[0]).toEqual({
      id: "9",
      adminId: "7",
      adminName: "Sari",
      appId: null,
      appName: "Tes CPNS",
      appSlug: "tes-cpns",
      action: "update",
      entityType: "app_config",
      entityId: "1",
      summary: "Mengubah konfigurasi aplikasi Tes CPNS",
      ipAddress: "203.0.113.7",
      createdAt: new Date("2026-11-17T00:00:00.000Z"),
    });
  });

  it("filter id tak valid → BadRequestException", async () => {
    const { service, logs } = makeService();
    await expect(
      service.list({ filter: { appId: "bukan-id" } }),
    ).rejects.toThrow(BadRequestException);
    expect(logs.list).not.toHaveBeenCalled();
    expect(logs.count).not.toHaveBeenCalled();
  });
});
