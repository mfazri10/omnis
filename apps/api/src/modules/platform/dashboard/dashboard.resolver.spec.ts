import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../../common/decorators/app-scoped.decorator";
import { PERMISSIONS_KEY } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { DashboardResolver } from "./dashboard.resolver";

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

describe("DashboardResolver metadata", () => {
  it("dikunci AuthGuard + AppContextGuard + PermissionGuard urut", () => {
    expect(guardsOf(DashboardResolver)).toEqual([
      AuthGuard,
      AppContextGuard,
      PermissionGuard,
    ]);
  });

  it("platformDashboard → platform.apps.view", () => {
    expect(permsOf(DashboardResolver.prototype, "platformDashboard")).toEqual([
      "platform.apps.view",
    ]);
  });

  it("platformDashboard TIDAK bertanda @AppScoped (operasi global)", () => {
    expect(
      scopedOf(DashboardResolver.prototype, "platformDashboard"),
    ).toBeFalsy();
  });

  it("appDashboard bertanda @AppScoped", () => {
    expect(scopedOf(DashboardResolver.prototype, "appDashboard")).toBe(true);
  });

  it("appDashboard tanpa permission tambahan (hak dari grant aplikasi)", () => {
    expect(
      permsOf(DashboardResolver.prototype, "appDashboard"),
    ).toBeUndefined();
  });
});
