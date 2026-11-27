import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../../common/decorators/app-scoped.decorator";
import { PERMISSIONS_KEY } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import {
  MediaUploadController,
  validateServePath,
} from "./media-upload.controller";

const reflector = new Reflector();

function methodOf(name: "upload" | "serve"): (...args: never[]) => unknown {
  const prototype: object = MediaUploadController.prototype;
  const fn = (prototype as Record<string, (...args: never[]) => unknown>)[
    name
  ];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${name}`);
  }
  return fn;
}

describe("MediaUploadController metadata", () => {
  it("upload dikunci AuthGuard + AppContextGuard + PermissionGuard urut", () => {
    const guards =
      (Reflect.getMetadata("__guards__", methodOf("upload")) as unknown[]) ??
      [];
    expect(guards).toEqual([AuthGuard, AppContextGuard, PermissionGuard]);
  });

  it("upload → platform.media.create + @AppScoped", () => {
    expect(reflector.get<string[]>(PERMISSIONS_KEY, methodOf("upload"))).toEqual(
      ["platform.media.create"],
    );
    expect(reflector.get<boolean>(APP_SCOPED_KEY, methodOf("upload"))).toBe(
      true,
    );
  });

  it("serve publik: tanpa guard dan tanpa permission", () => {
    const guards =
      (Reflect.getMetadata("__guards__", methodOf("serve")) as unknown[]) ??
      [];
    expect(guards).toEqual([]);
    expect(
      reflector.get<string[]>(PERMISSIONS_KEY, methodOf("serve")),
    ).toBeUndefined();
  });
});

describe("validateServePath", () => {
  it("menerima key normal", () => {
    expect(
      validateServePath("tes-cpns", "550e8400-e29b-41d4-a716-446655440000.png"),
    ).toBe("tes-cpns/550e8400-e29b-41d4-a716-446655440000.png");
  });

  it.each(["..", "../x.png", "a/b.png", "a\\b.png", "a\0b.png"])(
    "menolak traversal %p",
    (file: string) => {
      expect(() => validateServePath("tes-cpns", file)).toThrow(
        BadRequestException,
      );
    },
  );

  it("menolak slug di luar pola", () => {
    expect(() => validateServePath("../x", "berkas.png")).toThrow(
      BadRequestException,
    );
  });
});

describe("MediaUploadController.serve storage mode", () => {
  it("does not read local media when S3 is selected", async () => {
    const controller = new MediaUploadController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => "s3" } as unknown as ConfigService,
    );

    await expect(controller.serve("app-test", "file.png")).rejects.toThrow(
      NotFoundException,
    );
  });
});
