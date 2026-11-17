import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../../common/decorators/app-scoped.decorator";
import { PERMISSIONS_KEY } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { MediaResolver } from "./media.resolver";

const reflector = new Reflector();

function permsOf(target: object, method: string): string[] | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[
    method
  ];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<string[]>(PERMISSIONS_KEY, fn);
}

function guardsOf(target: object): unknown[] {
  return (Reflect.getMetadata("__guards__", target) as unknown[]) ?? [];
}

function scopedOf(target: object, method: string): boolean | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[
    method
  ];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<boolean>(APP_SCOPED_KEY, fn);
}

describe("MediaResolver metadata", () => {
  it("dikunci AuthGuard + AppContextGuard + PermissionGuard urut", () => {
    expect(guardsOf(MediaResolver)).toEqual([
      AuthGuard,
      AppContextGuard,
      PermissionGuard,
    ]);
  });

  it("media → platform.media.view", () => {
    expect(permsOf(MediaResolver.prototype, "media")).toEqual([
      "platform.media.view",
    ]);
  });

  it("deleteMedia → platform.media.delete", () => {
    expect(permsOf(MediaResolver.prototype, "deleteMedia")).toEqual([
      "platform.media.delete",
    ]);
  });

  it.each(["media", "deleteMedia"])("%s bertanda @AppScoped", (method: string) => {
    expect(scopedOf(MediaResolver.prototype, method)).toBe(true);
  });

  /**
   * Regresi: ValidationPipe global memakai whitelist + forbidNonWhitelisted.
   * Filter wajib menjadi properti kelas ArgsType agar request berfilter
   * tidak ditolak 400 (pola F06).
   */
  it("argumen media menerima filter tanpa ditolak whitelist", async () => {
    const { ValidationPipe } = await import("@nestjs/common");
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const { MediaPageArgs } = await import("./dto/media.input");
    const transformed = (await pipe.transform(
      { page: 1, perPage: 20, filter: { search: "soal" } },
      { type: "body", metatype: MediaPageArgs },
    )) as InstanceType<typeof MediaPageArgs>;

    expect(transformed.filter?.search).toBe("soal");
    expect(transformed.page).toBe(1);
  });
});
