import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Db } from "../../../database/database.service";
import type { StorageDriver } from "../../../storage/storage.driver";
import type { ActivityLogService } from "../activity-logs/activity-log.service";
import type { MediaRow } from "./media.entity";
import type { MediaRepository } from "./media.repository";
import type {
  MediaAuditContext,
  MediaService,
  UploadMediaFile,
} from "./media.service";

type Mocked<T> = { [K in keyof T]: jest.Mock };

const DB = {} as Db;
const SLUG = "tes-cpns";
const AUDIT: MediaAuditContext = {
  adminId: "7",
  appId: "1",
  ip: "203.0.113.7",
};

function row(over: Partial<MediaRow> = {}): MediaRow {
  return {
    id: 3,
    uploadedByAdminId: 7,
    fileName: "soal-1.png",
    path: "tes-cpns/uuid-acak.png",
    url: "http://localhost:3000/media/tes-cpns/uuid-acak.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    altText: "Diagram soal",
    createdAt: new Date("2026-11-17T00:00:00.000Z"),
    updatedAt: new Date("2026-11-17T00:00:00.000Z"),
    ...over,
  };
}

function file(over: Partial<UploadMediaFile> = {}): UploadMediaFile {
  return {
    buffer: Buffer.from("png-palsu"),
    originalName: "soal-1.png",
    mimeType: "image/png",
    size: 1024,
    altText: "Diagram soal",
    ...over,
  };
}

async function loadService(
  configValues: Record<string, string | number> = {},
): Promise<{
  service: MediaService;
  media: Mocked<MediaRepository>;
  activityLog: Mocked<ActivityLogService>;
  storage: Mocked<StorageDriver>;
}> {
  const { MediaService: Service } = await import("./media.service");
  const media = {
    list: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  } as unknown as Mocked<MediaRepository>;
  const activityLog = {
    record: jest.fn(),
  } as unknown as Mocked<ActivityLogService>;
  const storage = {
    put: jest.fn(),
    delete: jest.fn(),
    publicUrl: jest.fn(
      (key: string) => `http://localhost:3000/media/${key}`,
    ),
  } as unknown as Mocked<StorageDriver>;
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const service = new Service(
    media,
    activityLog as unknown as ActivityLogService,
    storage,
    config,
  );
  return { service, media, activityLog, storage };
}

describe("MediaService.upload", () => {
  it("menolak MIME di luar daftar izin", async () => {
    const { service, storage, media } = await loadService();
    await expect(
      service.upload(
        file({ originalName: "animasi.gif", mimeType: "image/gif" }),
        DB,
        SLUG,
        AUDIT,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
    expect(media.insert).not.toHaveBeenCalled();
  });

  it("menolak ekstensi yang tak sesuai MIME terkirim", async () => {
    const { service, storage } = await loadService();
    await expect(
      service.upload(
        file({ originalName: "dokumen.pdf", mimeType: "image/png" }),
        DB,
        SLUG,
        AUDIT,
      ),
    ).rejects.toThrow(/tidak sesuai/);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("menolak ekstensi tak dikenal walau MIME diizinkan", async () => {
    const { service, storage } = await loadService();
    await expect(
      service.upload(
        file({ originalName: "arsip.zip", mimeType: "image/png" }),
        DB,
        SLUG,
        AUDIT,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("menolak ukuran berlebih dengan pesan memuat batas", async () => {
    const { service, storage, media } = await loadService();
    const error = await service
      .upload(file({ size: 6 * 1024 * 1024 }), DB, SLUG, AUDIT)
      .then(
        () => null,
        (err: Error) => err,
      );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error?.message).toContain("5 MB");
    expect(storage.put).not.toHaveBeenCalled();
    expect(media.insert).not.toHaveBeenCalled();
  });

  it("memakai batas dari UPLOAD_MAX_BYTES bila dikonfigurasi", async () => {
    const { service } = await loadService({ UPLOAD_MAX_BYTES: 100 });
    await expect(
      service.upload(file({ size: 101 }), DB, SLUG, AUDIT),
    ).rejects.toThrow(/100 B/);
  });

  it("menyimpan dengan nama acak + prefix slug lalu mencatat audit", async () => {
    const { service, storage, media, activityLog } = await loadService();
    storage.put.mockResolvedValue(undefined);
    media.insert.mockResolvedValue(row());
    const input = file();
    const result = await service.upload(input, DB, SLUG, AUDIT);
    expect(storage.put).toHaveBeenCalledTimes(1);
    const putCalls = storage.put.mock.calls as Array<[string, Buffer, string]>;
    const key = putCalls[0]?.[0];
    expect(key).toMatch(/^tes-cpns\/[0-9a-f-]{36}\.png$/);
    expect(storage.put).toHaveBeenCalledWith(key, input.buffer, "image/png");
    expect(media.insert).toHaveBeenCalledWith(DB, {
      uploadedByAdminId: 7,
      fileName: "soal-1.png",
      path: key,
      url: `http://localhost:3000/media/${key}`,
      mimeType: "image/png",
      sizeBytes: 1024,
      altText: "Diagram soal",
    });
    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "7",
      appId: "1",
      action: "create",
      entityType: "media",
      entityId: "3",
      summary: "Mengunggah media soal-1.png",
      ip: "203.0.113.7",
    });
    expect(result.id).toBe("3");
    expect(result.url).toBe(
      "http://localhost:3000/media/tes-cpns/uuid-acak.png",
    );
  });
});

describe("MediaService.list", () => {
  it("meneruskan pencarian + pagination ke repository", async () => {
    const { service, media } = await loadService();
    media.list.mockResolvedValue([row()]);
    media.count.mockResolvedValue(1);
    await service.list(
      { filter: { search: "soal" }, page: 2, perPage: 10 },
      DB,
    );
    expect(media.list).toHaveBeenCalledWith(
      DB,
      { search: "soal" },
      { limit: 10, offset: 10 },
    );
    expect(media.count).toHaveBeenCalledWith(DB, { search: "soal" });
  });

  it("perPage dijepit maksimal 100", async () => {
    const { service, media } = await loadService();
    media.list.mockResolvedValue([]);
    media.count.mockResolvedValue(0);
    await service.list({ page: 1, perPage: 500 }, DB);
    expect(media.list).toHaveBeenCalledWith(
      DB,
      { search: undefined },
      { limit: 100, offset: 0 },
    );
  });
});

describe("MediaService.remove", () => {
  it("NotFound untuk id yang tak ada", async () => {
    const { service, media, storage } = await loadService();
    media.findById.mockResolvedValue(null);
    await expect(service.remove("99", DB, SLUG, AUDIT)).rejects.toThrow(
      NotFoundException,
    );
    expect(storage.delete).not.toHaveBeenCalled();
    expect(media.delete).not.toHaveBeenCalled();
  });

  it("NotFound bila path bukan milik slug konteks", async () => {
    const { service, media, storage } = await loadService();
    media.findById.mockResolvedValue(row({ path: "lain/berkas.png" }));
    await expect(service.remove("3", DB, SLUG, AUDIT)).rejects.toThrow(
      NotFoundException,
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("menghapus berkas lalu baris dan mencatat audit delete", async () => {
    const { service, media, storage, activityLog } = await loadService();
    media.findById.mockResolvedValue(row());
    storage.delete.mockResolvedValue(undefined);
    media.delete.mockResolvedValue(undefined);
    const result = await service.remove("3", DB, SLUG, AUDIT);
    expect(storage.delete).toHaveBeenCalledWith("tes-cpns/uuid-acak.png");
    expect(media.delete).toHaveBeenCalledWith(DB, 3);
    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "7",
      appId: "1",
      action: "delete",
      entityType: "media",
      entityId: "3",
      summary: "Menghapus media soal-1.png",
      ip: "203.0.113.7",
    });
    expect(result).toBe(true);
  });
});
