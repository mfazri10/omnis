import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../../common/decorators/app-scoped.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { PERMISSIONS_KEY } from "../../../common/decorators/require-permissions.decorator";
import { AdminsResolver } from "../admins/admins.resolver";
import { AppsResolver } from "../apps/apps.resolver";
import { RolesResolver } from "./roles.resolver";

const reflector = new Reflector();

function permsOf(target: object, method: string): string[] | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[method];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<string[]>(PERMISSIONS_KEY, fn);
}

function guardsOf(target: object): unknown[] {
  return (Reflect.getMetadata("__guards__", target) as unknown[]) ?? [];
}

function scopedOf(target: object, method: string): boolean | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[method];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<boolean>(APP_SCOPED_KEY, fn);
}

describe("RBAC resolver metadata", () => {
  it("RolesResolver dikunci AuthGuard + PermissionGuard", () => {
    const guards = guardsOf(RolesResolver);
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(PermissionGuard);
  });

  it("AdminsResolver dikunci AuthGuard + PermissionGuard", () => {
    const guards = guardsOf(AdminsResolver);
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(PermissionGuard);
  });

  it.each([
    ["roles", "platform.roles.view"],
    ["permissions", "platform.roles.view"],
    ["createRole", "platform.roles.manage"],
    ["updateRole", "platform.roles.manage"],
    ["deleteRole", "platform.roles.manage"],
    ["assignRole", "platform.roles.manage"],
    ["unassignRole", "platform.roles.manage"],
  ])("RolesResolver.%s → %s", (method: string, perm: string) => {
    expect(permsOf(RolesResolver.prototype, method)).toEqual([perm]);
  });

  it.each([
    ["admins", "platform.admins.view"],
    ["admin", "platform.admins.view"],
    ["createAdmin", "platform.admins.manage"],
    ["updateAdmin", "platform.admins.manage"],
    ["setAdminActive", "platform.admins.manage"],
    ["effectivePermissions", "platform.admins.view"],
    ["adminAssignments", "platform.admins.view"],
  ])("AdminsResolver.%s → %s", (method: string, perm: string) => {
    expect(permsOf(AdminsResolver.prototype, method)).toEqual([perm]);
  });

  it("currentAdmin tanpa metadata permission (AuthGuard saja)", () => {
    expect(permsOf(AdminsResolver.prototype, "currentAdmin")).toBeUndefined();
  });

  it.each(["myApps", "appContext"])(
    "AppsResolver.%s tanpa metadata permission (AuthGuard saja)",
    (method: string) => {
      expect(
        permsOf(AppsResolver.prototype, method),
      ).toBeUndefined();
    },
  );

  it("AdminsResolver.myPermissions tanpa metadata permission (AuthGuard saja)", () => {
    expect(permsOf(AdminsResolver.prototype, "myPermissions")).toBeUndefined();
  });

  it("AppsResolver.appContext bertanda @AppScoped", () => {
    expect(scopedOf(AppsResolver.prototype, "appContext")).toBe(true);
  });

  it.each(["myApps", "myPermissions"])(
    "%s bukan app-scoped",
    (method: string) => {
      const target =
        method === "myApps" ? AppsResolver.prototype : AdminsResolver.prototype;
      expect(scopedOf(target, method)).toBeUndefined();
    },
  );

  it("AppsResolver dikunci AuthGuard + AppContextGuard + PermissionGuard urut", () => {
    const guards = guardsOf(AppsResolver);
    expect(guards).toEqual([AuthGuard, AppContextGuard, PermissionGuard]);
  });

  it("AppsResolver.apps → platform.apps.view", () => {
    expect(permsOf(AppsResolver.prototype, "apps")).toEqual([
      "platform.apps.view",
    ]);
  });

  it("AppsResolver.app → platform.apps.view", () => {
    expect(permsOf(AppsResolver.prototype, "app")).toEqual([
      "platform.apps.view",
    ]);
  });

  it.each([
    "provisionApp",
    "retryProvisionApp",
    "updateApp",
    "suspendApp",
    "unsuspendApp",
    "archiveApp",
    "deleteApp",
    "setFcmCredential",
  ])("AppsResolver.%s → platform.apps.manage", (method: string) => {
    expect(permsOf(AppsResolver.prototype, method)).toEqual([
      "platform.apps.manage",
    ]);
  });

  it.each([
    "apps",
    "app",
    "provisionApp",
    "retryProvisionApp",
    "updateApp",
    "suspendApp",
    "unsuspendApp",
    "archiveApp",
    "deleteApp",
    "setFcmCredential",
  ])("AppsResolver.%s bukan app-scoped", (method: string) => {
    expect(scopedOf(AppsResolver.prototype, method)).toBeUndefined();
  });

  it.each([
    "admins",
    "admin",
    "currentAdmin",
    "effectivePermissions",
    "adminAssignments",
    "createAdmin",
    "updateAdmin",
    "setAdminActive",
  ])("AdminsResolver.%s bukan app-scoped", (method: string) => {
    expect(scopedOf(AdminsResolver.prototype, method)).toBeUndefined();
  });

  it.each([
    "roles",
    "permissions",
    "createRole",
    "updateRole",
    "deleteRole",
    "assignRole",
    "unassignRole",
  ])("RolesResolver.%s bukan app-scoped", (method: string) => {
    expect(scopedOf(RolesResolver.prototype, method)).toBeUndefined();
  });
});
