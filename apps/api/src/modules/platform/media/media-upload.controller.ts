import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { createReadStream, promises as fs } from "node:fs";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { AppContext } from "../../../common/decorators/app-context.decorator";
import type { AppContext as AppContextData } from "../../../common/types/request-context";
import { AppScoped } from "../../../common/decorators/app-scoped.decorator";
import { ClientIp } from "../../../common/decorators/client-ip.decorator";
import { CurrentAdmin } from "../../../common/decorators/current-admin.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { DatabaseService } from "../../../database/database.service";
import { LocalStorageDriver } from "../../../storage/local-storage.driver";
import { ConfigService } from "@nestjs/config";
import type { AdminProfile } from "../admins/admins.service";
import { AppsRepository } from "../apps/apps.repository";
import { MediaService } from "./media.service";
import { UploadExceptionFilter } from "./upload-exception.filter";
import { UploadFileInterceptor } from "./upload-file.interceptor";

/**
 * Bentuk minimal berkas multer yang dipakai controller. Didefinisikan
 * sendiri karena repo tidak membawa @types/multer (dilarang tambah dep).
 */
export interface UploadedMediaFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export class UploadMediaBody {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  altText?: string;
}

export interface UploadMediaResponse {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const SERVE_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * Validasi path penyajian: tolak traversal (`..`, `/`, `\`, null byte)
 * dan nama di luar pola aman sebelum menyentuh filesystem/registry.
 */
export function validateServePath(slug: string, file: string): string {
  if (!SLUG_PATTERN.test(slug)) {
    throw new BadRequestException("Slug aplikasi tidak valid.");
  }
  if (
    file.length === 0 ||
    file.includes("..") ||
    file.includes("/") ||
    file.includes("\\") ||
    file.includes("\0") ||
    !FILE_PATTERN.test(file)
  ) {
    throw new BadRequestException("Nama berkas tidak valid.");
  }
  return `${slug}/${file}`;
}

function contentTypeFor(file: string): string {
  const dot = file.lastIndexOf(".");
  const ext = dot >= 0 ? file.slice(dot + 1).toLowerCase() : "";
  return SERVE_CONTENT_TYPES[ext] ?? "application/octet-stream";
}

@Controller()
@UseFilters(UploadExceptionFilter)
export class MediaUploadController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly database: DatabaseService,
    private readonly apps: AppsRepository,
    private readonly localStorage: LocalStorageDriver,
    private readonly config: ConfigService,
  ) {}

  /**
   * POST /uploads (doc 07 §5): multipart field `file` + `altText` opsional.
   * Auth memakai guard yang sama dengan GraphQL: sesi cookie (AuthGuard),
   * X-App-Slug tervalidasi (AppContextGuard), permission create.
   */
  @Post("uploads")
  @AppScoped()
  @RequirePermissions("platform.media.create")
  @UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
  @UseInterceptors(UploadFileInterceptor)
  async upload(
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Body() body: UploadMediaBody,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<UploadMediaResponse> {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'Berkas wajib diunggah pada field "file".',
      );
    }
    // AppDatabaseInterceptor hanya menangani GraphQL; endpoint REST
    // me-resolve App DB sendiri dari slug yang sudah divalidasi guard.
    const db = await this.database.getAppConnection(ctx.slug, {
      allowNonActive: true,
    });
    const created = await this.mediaService.upload(
      {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        altText: body.altText,
      },
      db,
      ctx.slug,
      { adminId: admin.id, appId: ctx.appId, ip },
    );
    return {
      id: created.id,
      fileName: created.fileName,
      url: created.url,
      mimeType: created.mimeType,
      sizeBytes: created.sizeBytes,
    };
  }

  /**
   * GET /media/:slug/:file — pengganti URL S3 publik di dev (tanpa auth);
   * produksi memakai URL S3 langsung sehingga endpoint ini tak dipakai.
   */
  @Get("media/:slug/:file")
  @Header("Cache-Control", "public, max-age=86400")
  async serve(
    @Param("slug") slug: string,
    @Param("file") file: string,
  ): Promise<StreamableFile> {
    if ((this.config.get<string>("STORAGE_DRIVER") ?? "local") !== "local") {
      throw new NotFoundException("Media lokal tidak tersedia.");
    }
    const key = validateServePath(slug, file);
    const app = await this.apps.findBySlug(
      this.database.getControlPlaneConnection(),
      slug,
    );
    if (!app) {
      throw new NotFoundException(`Aplikasi "${slug}" tidak ditemukan.`);
    }
    const absolute = this.localStorage.absolutePath(key);
    let size: number;
    try {
      const stat = await fs.stat(absolute);
      if (!stat.isFile()) {
        throw new NotFoundException("Berkas tidak ditemukan.");
      }
      size = stat.size;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new NotFoundException("Berkas tidak ditemukan.");
      }
      throw error;
    }
    return new StreamableFile(createReadStream(absolute), {
      type: contentTypeFor(file),
      length: size,
    });
  }
}
