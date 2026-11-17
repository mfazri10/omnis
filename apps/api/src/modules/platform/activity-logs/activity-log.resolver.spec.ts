import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../../common/decorators/app-scoped.decorator";
import { PERMISSIONS_KEY } from "../../../common/decorators/require-permissions.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { ActivityLogResolver } from "./activity-log.resolver";

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

describe("ActivityLogResolver metadata", () => {
  it("dikunci AuthGuard + PermissionGuard urut", () => {
    expect(guardsOf(ActivityLogResolver)).toEqual([
      AuthGuard,
      PermissionGuard,
    ]);
  });

  it("activityLogs → platform.audit.view", () => {
    expect(permsOf(ActivityLogResolver.prototype, "activityLogs")).toEqual([
      "platform.audit.view",
    ]);
  });

  it("activityLogs bukan app-scoped", () => {
    expect(scopedOf(ActivityLogResolver.prototype, "activityLogs")).toBeUndefined();
  });

  /**
   * Regresi: ValidationPipe global memakai whitelist + forbidNonWhitelisted.
   * Sebelum perbaikan, `filter` adalah argumen terpisah di luar kelas ArgsType
   * sehingga setiap request berfilter ditolak 400 "Bad Request Exception" —
   * pagination tanpa filter tetap lolos, jadi bug ini hanya muncul di runtime.
   */
  it("argumen activityLogs menerima filter tanpa ditolak whitelist", async () => {
    const { ValidationPipe } = await import("@nestjs/common");
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const { ActivityLogPageArgs } = await import("./dto/activity-log.input");
    const transformed = (await pipe.transform(
      { page: 1, perPage: 20, filter: { appId: "1" } },
      { type: "body", metatype: ActivityLogPageArgs },
    )) as InstanceType<typeof ActivityLogPageArgs>;

    expect(transformed.filter?.appId).toBe("1");
    expect(transformed.page).toBe(1);
  });
});
