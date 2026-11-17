import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../../common/decorators/app-scoped.decorator";
import { PERMISSIONS_KEY } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { AppUsersResolver } from "./app-users.resolver";

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

describe("AppUsersResolver metadata", () => {
  it("dikunci AuthGuard + AppContextGuard + PermissionGuard urut", () => {
    expect(guardsOf(AppUsersResolver)).toEqual([
      AuthGuard,
      AppContextGuard,
      PermissionGuard,
    ]);
  });

  it("appUsers → platform.users.view", () => {
    expect(permsOf(AppUsersResolver.prototype, "appUsers")).toEqual([
      "platform.users.view",
    ]);
  });

  it.each(["createAppUser", "updateAppUser", "setAppUserActive"])(
    "%s → platform.users.manage",
    (method: string) => {
      expect(permsOf(AppUsersResolver.prototype, method)).toEqual([
        "platform.users.manage",
      ]);
    },
  );

  it.each([
    "appUsers",
    "createAppUser",
    "updateAppUser",
    "setAppUserActive",
  ])("%s bertanda @AppScoped", (method: string) => {
    expect(scopedOf(AppUsersResolver.prototype, method)).toBe(true);
  });

  /**
   * Regresi: ValidationPipe global memakai whitelist + forbidNonWhitelisted.
   * Filter wajib menjadi properti kelas ArgsType agar request berfilter
   * tidak ditolak 400 (pola F06).
   */
  it("argumen appUsers menerima filter tanpa ditolak whitelist", async () => {
    const { ValidationPipe } = await import("@nestjs/common");
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const { AppUserPageArgs } = await import("./dto/app-user.input");
    const transformed = (await pipe.transform(
      { page: 1, perPage: 20, filter: { search: "budi", status: "active" } },
      { type: "body", metatype: AppUserPageArgs },
    )) as InstanceType<typeof AppUserPageArgs>;

    expect(transformed.filter?.search).toBe("budi");
    expect(transformed.filter?.status).toBe("active");
    expect(transformed.page).toBe(1);
  });
});
