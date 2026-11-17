import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { Db } from "../../../database/database.service";
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from "../../../storage/storage.driver";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import type { MediaRow } from "./media.entity";
import type { InsertMediaRow } from "./media.repository";
import { MediaRepository } from "./media.repository";

export interface MediaFilterInput {
  search?: string;
}

export interface ListMediaInput {
  filter?: MediaFilterInput;
  page?: number;
  perPage?: number;
}

export interface UploadMediaFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  altText?: string;
}

export interface MediaAuditContext {
  adminId: string;
  appId: string;
  ip: string | null;
}

export interface MediaItem {
  id: string;
  fileName: string;
  path: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  uploadedByAdminId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

const DEFAULT_MAX_BYTES = 5242880;
const DEFAULT_ALLOWED_MIME =
  "image/jpeg,image/png,image/webp,application/pdf";

/** Ekstensi kanonis per MIME yang dikenal (nama berkas selalu acak). */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

const MIME_LABELS: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "application/pdf": "PDF",
};

function toItem(row: MediaRow): MediaItem {
  return {
    id: String(row.id),
    fileName: row.fileName,
    path: row.path,
    url: row.url,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    altText: row.altText,
    uploadedByAdminId:
      row.uploadedByAdminId === null ? null : String(row.uploadedByAdminId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    const text = mb >= 10 ? String(Math.round(mb)) : String(+mb.toFixed(1));
    return `${text} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly media: MediaRepository,
    private readonly activityLog: ActivityLogService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly config: ConfigService,
  ) {}

  async list(
    input: ListMediaInput,
    db: Db,
  ): Promise<{ items: MediaItem[]; total: number }> {
    const page =
      input.page !== undefined &&
      Number.isInteger(input.page) &&
      input.page > 0
        ? input.page
        : DEFAULT_PAGE;
    const perPage =
      input.perPage !== undefined &&
      Number.isInteger(input.perPage) &&
      input.perPage > 0
        ? Math.min(input.perPage, MAX_PER_PAGE)
        : DEFAULT_PER_PAGE;
    const filters = { search: input.filter?.search };
    const [rows, total] = await Promise.all([
      this.media.list(db, filters, {
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      this.media.count(db, filters),
    ]);
    return { items: rows.map(toItem), total };
  }

  async upload(
    file: UploadMediaFile,
    db: Db,
    appSlug: string,
    audit: MediaAuditContext,
  ): Promise<MediaItem> {
    const maxBytes = this.maxBytes();
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `Ukuran file ${formatBytes(file.size)} melebihi batas ${formatBytes(maxBytes)}. Kecilkan file lalu coba lagi.`,
      );
    }
    const allowed = this.allowedMime();
    const mimeType = file.mimeType.trim().toLowerCase();
    if (!allowed.includes(mimeType)) {
      throw new BadRequestException(
        `Tipe file "${file.mimeType}" tidak didukung. Tipe yang diizinkan: ${this.allowedLabels(allowed)}.`,
      );
    }
    this.rejectExtensionMismatch(file.originalName, mimeType, allowed);
    const extension = this.extensionFor(mimeType, file.originalName);
    const key = `${appSlug}/${randomUUID()}.${extension}`;
    await this.storage.put(key, file.buffer, mimeType);
    const row: InsertMediaRow = {
      uploadedByAdminId: this.parseAdminId(audit.adminId),
      fileName: file.originalName,
      path: key,
      url: this.storage.publicUrl(key),
      mimeType,
      sizeBytes: file.size,
      altText: this.normalizeAlt(file.altText),
    };
    const created = await this.media.insert(db, row);
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "create",
      entityType: "media",
      entityId: String(created.id),
      summary: `Mengunggah media ${created.fileName}`,
      ip: audit.ip,
    });
    return toItem(created);
  }

  async remove(
    id: string,
    db: Db,
    appSlug: string,
    audit: MediaAuditContext,
  ): Promise<boolean> {
    const numericId = this.parseId(id);
    const existing = await this.media.findById(db, numericId);
    if (!existing || !existing.path.startsWith(`${appSlug}/`)) {
      throw new NotFoundException("Media tidak ditemukan.");
    }
    await this.storage.delete(existing.path);
    await this.media.delete(db, numericId);
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: audit.appId,
      action: "delete",
      entityType: "media",
      entityId: String(existing.id),
      summary: `Menghapus media ${existing.fileName}`,
      ip: audit.ip,
    });
    return true;
  }

  /**
   * Content-type dikirim klien sehingga tidak dipercaya sendirian:
   * ekstensi nama berkas harus memetakan ke MIME izin yang sama.
   */
  private rejectExtensionMismatch(
    originalName: string,
    mimeType: string,
    allowed: string[],
  ): void {
    const dot = originalName.lastIndexOf(".");
    if (dot < 0 || dot === originalName.length - 1) {
      return;
    }
    const ext = originalName.slice(dot + 1).toLowerCase();
    const mapped = EXT_TO_MIME[ext];
    if (mapped === undefined || !allowed.includes(mapped)) {
      throw new BadRequestException(
        `Ekstensi file ".${ext}" tidak didukung. Tipe yang diizinkan: ${this.allowedLabels(allowed)}.`,
      );
    }
    if (mapped !== mimeType) {
      throw new BadRequestException(
        `Ekstensi file ".${ext}" tidak sesuai dengan tipe file "${mimeType}".`,
      );
    }
  }

  private extensionFor(mimeType: string, originalName: string): string {
    const known = MIME_TO_EXT[mimeType];
    if (known !== undefined) {
      return known;
    }
    const dot = originalName.lastIndexOf(".");
    const raw =
      dot >= 0 ? originalName.slice(dot + 1).toLowerCase() : "";
    if (/^[a-z0-9]{1,10}$/.test(raw)) {
      return raw;
    }
    return "bin";
  }

  private maxBytes(): number {
    const raw = this.config.get<number>("UPLOAD_MAX_BYTES");
    return typeof raw === "number" && raw > 0 ? raw : DEFAULT_MAX_BYTES;
  }

  private allowedMime(): string[] {
    const raw =
      this.config.get<string>("UPLOAD_ALLOWED_MIME") ?? DEFAULT_ALLOWED_MIME;
    const list = raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part !== "");
    return list.length > 0 ? list : DEFAULT_ALLOWED_MIME.split(",");
  }

  private allowedLabels(allowed: string[]): string {
    return allowed.map((mime) => MIME_LABELS[mime] ?? mime).join(", ");
  }

  private normalizeAlt(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  private parseId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }

  private parseAdminId(adminId: string): number | null {
    const numeric = Number(adminId);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  }
}
