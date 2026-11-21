import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Penyimpanan berkas ekspor di `EXPORT_STORAGE_ROOT`, root terpisah
 * dari media publik. File ekspor tak pernah bocor lewat endpoint
 * publik GET /media/:slug/:file karena di luar root itu.
 */
@Injectable()
export class ExportFileStore {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(
      config.get<string>("EXPORT_STORAGE_ROOT") ?? "./storage/exports",
    );
  }

  async put(key: string, buffer: Buffer): Promise<void> {
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

  /** Path absolut untuk streaming unduhan; menolak traversal. */
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
