import {
  GoneException,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import type { Response } from "express";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthGuard } from "../../../common/guards/auth.guard";
import type { AdminProfile } from "../admins/admins.service";
import { ExportsController } from "./exports.controller";
import type { ExportsService } from "./exports.service";

const ADMIN: AdminProfile = {
  id: "7",
  authUserId: "auth-7",
  name: "Admin Uji",
  email: "admin@contoh.id",
  isSuperAdmin: false,
};

function responseMock(): {
  res: Response;
  setHeader: jest.Mock;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const setHeader = jest.fn((name: string, value: string) => {
    headers[name] = value;
  });
  const res = { setHeader } as unknown as Response;
  return { res, setHeader, headers };
}

function downloadOf(): (...args: never[]) => unknown {
  const prototype = ExportsController.prototype as unknown as Record<
    string,
    (...args: never[]) => unknown
  >;
  const fn = prototype["download"];
  if (typeof fn !== "function") {
    throw new Error("Method tak ada: download");
  }
  return fn;
}

describe("ExportsController metadata", () => {
  it("download dikunci AuthGuard saja", () => {
    const guards =
      (Reflect.getMetadata("__guards__", downloadOf()) as unknown[]) ?? [];
    expect(guards).toEqual([AuthGuard]);
  });
});

describe("ExportsController.download", () => {
  it("pemilik mendapat stream CSV beserta header unduhan", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "ekspor-uji-"));
    const absolutePath = join(dir, "7.csv");
    await fs.writeFile(absolutePath, "﻿id,name\r\n1,budi\r\n");
    try {
      const download = jest.fn().mockResolvedValue({
        absolutePath,
        fileName: "ekspor-user-aplikasi-tes-cpns-20261121-100000.csv",
        sizeBytes: 20,
      });
      const service = { download } as unknown as ExportsService;
      const controller = new ExportsController(service);
      const { res, setHeader } = responseMock();

      const result = await controller.download("7", ADMIN, null, res);

      expect(download).toHaveBeenCalledWith("7", ADMIN, null);
      expect(setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/csv; charset=utf-8",
      );
      expect(setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="ekspor-user-aplikasi-tes-cpns-20261121-100000.csv"',
      );
      expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      expect(result).toBeInstanceOf(StreamableFile);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("bukan pemilik → 404 dari service diteruskan", async () => {
    const service = {
      download: jest
        .fn()
        .mockRejectedValue(new NotFoundException("Job ekspor tidak ditemukan.")),
    } as unknown as ExportsService;
    const controller = new ExportsController(service);

    await expect(
      controller.download("7", ADMIN, null, responseMock().res),
    ).rejects.toThrow(NotFoundException);
  });

  it("tautan kedaluwarsa → 410 dari service diteruskan", async () => {
    const service = {
      download: jest.fn().mockRejectedValue(
        new GoneException("Tautan unduh sudah kedaluwarsa. Buat ekspor baru."),
      ),
    } as unknown as ExportsService;
    const controller = new ExportsController(service);

    await expect(
      controller.download("7", ADMIN, null, responseMock().res),
    ).rejects.toThrow(GoneException);
  });
});
