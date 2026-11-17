import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { Db } from "../../../database/database.service";
import type { ActivityLogService } from "../activity-logs/activity-log.service";
import type { AppUserRow } from "./app-users.entity";
import type { AppUsersRepository } from "./app-users.repository";
import type { CreateAppUserInput } from "./dto/app-user.input";
import type {
  AppUserAuditContext,
  AppUsersService,
} from "./app-users.service";

type Mocked<T> = { [K in keyof T]: jest.Mock };

const DB = {} as Db;
const AUDIT: AppUserAuditContext = {
  adminId: "7",
  appId: "1",
  ip: "203.0.113.7",
};

function row(over: Partial<AppUserRow> = {}): AppUserRow {
  return {
    id: 9,
    name: "Budi",
    email: "budi@contoh.id",
    phone: "+6281234567890",
    avatarUrl: null,
    isActive: true,
    metadata: null,
    lastLoginAt: null,
    createdAt: new Date("2026-11-17T00:00:00.000Z"),
    updatedAt: new Date("2026-11-17T00:00:00.000Z"),
    ...over,
  };
}

function createInput(over: Partial<CreateAppUserInput> = {}): CreateAppUserInput {
  return { name: "Budi", email: "budi@contoh.id", ...over };
}

async function loadService(): Promise<{
  service: AppUsersService;
  users: Mocked<AppUsersRepository>;
  activityLog: Mocked<ActivityLogService>;
}> {
  const { AppUsersService: Service } = await import("./app-users.service");
  const users = {
    list: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    emailExists: jest.fn(),
    phoneExists: jest.fn(),
  } as unknown as Mocked<AppUsersRepository>;
  const activityLog = {
    record: jest.fn(),
  } as unknown as Mocked<ActivityLogService>;
  const service = new Service(
    users,
    activityLog as unknown as ActivityLogService,
  );
  return { service, users, activityLog };
}

describe("AppUsersService.list", () => {
  it("memetakan filter status + pencarian ke repository", async () => {
    const { service, users } = await loadService();
    users.list.mockResolvedValue([row()]);
    users.count.mockResolvedValue(1);
    await service.list(
      { filter: { search: "budi", status: "active" }, page: 2, perPage: 10 },
      DB,
    );
    expect(users.list).toHaveBeenCalledWith(
      DB,
      { search: "budi", status: "active" },
      { limit: 10, offset: 10 },
    );
  });

  it("total dihitung dengan filter yang sama", async () => {
    const { service, users } = await loadService();
    users.list.mockResolvedValue([row()]);
    users.count.mockResolvedValue(42);
    const result = await service.list(
      { filter: { status: "inactive" }, page: 1, perPage: 20 },
      DB,
    );
    expect(users.count).toHaveBeenCalledWith(DB, { status: "inactive" });
    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(1);
  });

  it("default halaman 1 dan 20 baris", async () => {
    const { service, users } = await loadService();
    users.list.mockResolvedValue([]);
    users.count.mockResolvedValue(0);
    await service.list({}, DB);
    expect(users.list).toHaveBeenCalledWith(DB, {}, { limit: 20, offset: 0 });
  });

  it("perPage dijepit maksimal 100", async () => {
    const { service, users } = await loadService();
    users.list.mockResolvedValue([]);
    users.count.mockResolvedValue(0);
    await service.list({ page: 1, perPage: 500 }, DB);
    expect(users.list).toHaveBeenCalledWith(
      DB,
      {},
      { limit: 100, offset: 0 },
    );
  });

  it("items dipetakan ke id string dan metadata string", async () => {
    const { service, users } = await loadService();
    users.list.mockResolvedValue([
      row({ metadata: { outlet: "kasir-1" }, lastLoginAt: null }),
    ]);
    users.count.mockResolvedValue(1);
    const result = await service.list({}, DB);
    expect(result.items[0]).toEqual({
      id: "9",
      name: "Budi",
      email: "budi@contoh.id",
      phone: "+6281234567890",
      avatarUrl: null,
      isActive: true,
      metadata: `{"outlet":"kasir-1"}`,
      lastLoginAt: null,
      createdAt: new Date("2026-11-17T00:00:00.000Z"),
      updatedAt: new Date("2026-11-17T00:00:00.000Z"),
    });
  });
});

describe("AppUsersService.create", () => {
  it("menolak email duplikat di App DB yang sama", async () => {
    const { service, users } = await loadService();
    users.emailExists.mockResolvedValue(true);
    users.phoneExists.mockResolvedValue(false);
    await expect(service.create(createInput(), DB, AUDIT)).rejects.toThrow(
      ConflictException,
    );
    expect(users.insert).not.toHaveBeenCalled();
  });

  it("menolak phone duplikat di App DB yang sama", async () => {
    const { service, users } = await loadService();
    users.emailExists.mockResolvedValue(false);
    users.phoneExists.mockResolvedValue(true);
    await expect(
      service.create(createInput({ phone: "+6281234567890" }), DB, AUDIT),
    ).rejects.toThrow(ConflictException);
    expect(users.insert).not.toHaveBeenCalled();
  });

  it("menolak bila email dan phone dua-duanya kosong", async () => {
    const { service, users } = await loadService();
    await expect(
      service.create(createInput({ email: undefined }), DB, AUDIT),
    ).rejects.toThrow(BadRequestException);
    expect(users.insert).not.toHaveBeenCalled();
  });

  it("menolak metadata yang bukan JSON object", async () => {
    const { service, users } = await loadService();
    await expect(
      service.create(createInput({ metadata: "bukan-json" }), DB, AUDIT),
    ).rejects.toThrow(BadRequestException);
    expect(users.insert).not.toHaveBeenCalled();
  });

  it("menyimpan lalu mencatat audit create dengan appId konteks", async () => {
    const { service, users, activityLog } = await loadService();
    users.emailExists.mockResolvedValue(false);
    users.phoneExists.mockResolvedValue(false);
    users.insert.mockResolvedValue(row());
    const result = await service.create(
      createInput({ metadata: `{"outlet":"kasir-1"}` }),
      DB,
      AUDIT,
    );
    expect(users.insert).toHaveBeenCalledWith(DB, {
      name: "Budi",
      email: "budi@contoh.id",
      phone: null,
      avatarUrl: null,
      metadata: { outlet: "kasir-1" },
    });
    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "7",
      appId: "1",
      action: "create",
      entityType: "app_user",
      entityId: "9",
      summary: "Menambah user aplikasi Budi",
      ip: "203.0.113.7",
    });
    expect(result.id).toBe("9");
  });
});

describe("AppUsersService.update", () => {
  it("NotFound untuk id yang tak ada", async () => {
    const { service, users } = await loadService();
    users.findById.mockResolvedValue(null);
    await expect(
      service.update("99", { name: "Baru" }, DB, AUDIT),
    ).rejects.toThrow(NotFoundException);
    expect(users.update).not.toHaveBeenCalled();
  });

  it("menolak email duplikat milik user lain", async () => {
    const { service, users } = await loadService();
    users.findById.mockResolvedValue(row());
    users.emailExists.mockResolvedValue(true);
    users.phoneExists.mockResolvedValue(false);
    await expect(
      service.update("9", { email: "lain@contoh.id" }, DB, AUDIT),
    ).rejects.toThrow(ConflictException);
    expect(users.emailExists).toHaveBeenCalledWith(
      DB,
      "lain@contoh.id",
      9,
    );
    expect(users.update).not.toHaveBeenCalled();
  });

  it("menolak bila email dan phone dikirim null dua-duanya", async () => {
    const { service, users } = await loadService();
    users.findById.mockResolvedValue(row());
    await expect(
      service.update("9", { email: null, phone: null }, DB, AUDIT),
    ).rejects.toThrow(BadRequestException);
    expect(users.update).not.toHaveBeenCalled();
  });

  it("menyimpan patch lalu mencatat audit update", async () => {
    const { service, users, activityLog } = await loadService();
    users.findById.mockResolvedValue(row());
    users.emailExists.mockResolvedValue(false);
    users.phoneExists.mockResolvedValue(false);
    users.update.mockResolvedValue(row({ name: "Budi Baru" }));
    const result = await service.update("9", { name: "Budi Baru" }, DB, AUDIT);
    expect(users.update).toHaveBeenCalledWith(
      DB,
      9,
      expect.objectContaining({ name: "Budi Baru" }),
    );
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "1",
        action: "update",
        entityType: "app_user",
        entityId: "9",
      }),
    );
    expect(result.name).toBe("Budi Baru");
  });
});

describe("AppUsersService.setActive", () => {
  it("NotFound untuk id yang tak ada", async () => {
    const { service, users } = await loadService();
    users.findById.mockResolvedValue(null);
    await expect(service.setActive("99", false, DB, AUDIT)).rejects.toThrow(
      NotFoundException,
    );
    expect(users.update).not.toHaveBeenCalled();
  });

  it("nonaktif mencatat audit deactivate dengan appId konteks", async () => {
    const { service, users, activityLog } = await loadService();
    users.findById.mockResolvedValue(row());
    users.update.mockResolvedValue(row({ isActive: false }));
    const result = await service.setActive("9", false, DB, AUDIT);
    expect(users.update).toHaveBeenCalledWith(
      DB,
      9,
      expect.objectContaining({ isActive: false }),
    );
    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "7",
      appId: "1",
      action: "deactivate",
      entityType: "app_user",
      entityId: "9",
      summary: "Menonaktifkan user aplikasi Budi",
      ip: "203.0.113.7",
    });
    expect(result.isActive).toBe(false);
  });

  it("aktif kembali mencatat audit update", async () => {
    const { service, users, activityLog } = await loadService();
    users.findById.mockResolvedValue(row({ isActive: false }));
    users.update.mockResolvedValue(row({ isActive: true }));
    await service.setActive("9", true, DB, AUDIT);
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update" }),
    );
  });

  it("id tak valid → BadRequestException", async () => {
    const { service, users } = await loadService();
    await expect(service.setActive("bukan-id", false, DB, AUDIT)).rejects.toThrow(
      BadRequestException,
    );
    expect(users.findById).not.toHaveBeenCalled();
  });
});
