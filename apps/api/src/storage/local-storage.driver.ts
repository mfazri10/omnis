import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageDriver } from "./storage.driver";

/**
 * Driver lokal Fase 1: berkas di `STORAGE_LOCAL_ROOT`, URL publik dari
 * `STORAGE_PUBLIC_BASE_URL` (dilayani GET /media/:slug/:file).
 * Produksi memakai driver S3 dengan interface yang sama.
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(
      config.get<string>("STORAGE_LOCAL_ROOT") ?? "./storage/media",
    );
    this.baseUrl = (
      config.get<string>("STORAGE_PUBLIC_BASE_URL") ??
      "http://localhost:3000/media"
    ).replace(/\/+$/, "");
  }

  async put(
    key: string,
    buffer: Buffer,
    _mimeType: string,
  ): Promise<void> {
    void _mimeType;
    const absolute = this.safePath(key);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, buffer);
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.safePath(key));
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error;
    }
  }

  publicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  /**
   * Path absolut untuk penyajian GET; melempar bila key keluar dari root.
   * Di luar interface StorageDriver (khusus kebutuhan controller lokal).
   */
  absolutePath(key: string): string {
    return this.safePath(key);
  }

  private safePath(key: string): string {
    const segments = key.split("/");
    const valid =
      key.length > 0 &&
      !key.includes("\0") &&
      segments.every(
        (segment) =>
          segment !== "" && segment !== "." && segment !== "..",
      );
    if (!valid) {
      throw new BadRequestException("Path berkas tidak valid.");
    }
    const absolute = path.resolve(this.root, key);
    if (absolute !== this.root && !absolute.startsWith(this.root + path.sep)) {
      throw new BadRequestException("Path berkas tidak valid.");
    }
    return absolute;
  }
}
