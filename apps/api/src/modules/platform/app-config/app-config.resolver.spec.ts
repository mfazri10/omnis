import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../../common/decorators/app-scoped.decorator";
import { PERMISSIONS_KEY } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { AppConfigResolver } from "./app-config.resolver";

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

describe("AppConfigResolver metadata", () => {
  it("dikunci AuthGuard + AppContextGuard + PermissionGuard urut", () => {
    expect(guardsOf(AppConfigResolver)).toEqual([
      AuthGuard,
      AppContextGuard,
      PermissionGuard,
    ]);
  });

  it("appConfig → platform.app-config.view", () => {
    expect(permsOf(AppConfigResolver.prototype, "appConfig")).toEqual([
      "platform.app-config.view",
    ]);
  });

  it("updateAppConfig → platform.app-config.manage", () => {
    expect(
      permsOf(AppConfigResolver.prototype, "updateAppConfig"),
    ).toEqual(["platform.app-config.manage"]);
  });

  it("appConfig bertanda @AppScoped", () => {
    expect(scopedOf(AppConfigResolver.prototype, "appConfig")).toBe(true);
  });

  it("updateAppConfig bertanda @AppScoped", () => {
    expect(scopedOf(AppConfigResolver.prototype, "updateAppConfig")).toBe(
      true,
    );
  });
});
