import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { createReadStream } from "node:fs";
import { ClientIp } from "../../../common/decorators/client-ip.decorator";
import { CurrentAdmin } from "../../../common/decorators/current-admin.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import type { AdminProfile } from "../admins/admins.service";
import { ExportsService } from "./exports.service";

/**
 * GET /exports/:id/download untuk unduhan hasil ekspor ber-auth.
 * Tanpa sesi jadi 401 (AuthGuard); bukan pemilik jadi 404; kedaluwarsa 410.
 * Sengaja di luar /media agar tak tersaji sebagai berkas publik.
 */
@Controller("exports")
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get(":id/download")
  @UseGuards(AuthGuard)
  async download(
    @Param("id") id: string,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.exportsService.download(id, admin, ip);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.fileName}"`,
    );
    res.setHeader("Cache-Control", "no-store");
    return new StreamableFile(createReadStream(file.absolutePath), {
      length: file.sizeBytes,
    });
  }
}
