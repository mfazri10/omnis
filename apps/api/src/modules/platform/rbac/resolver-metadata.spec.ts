import { Reflector } from "@nestjs/core";
import { AuthGuard } from "../../../common/guards/auth.guard";
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

  it("AppsResolver dikunci AuthGuard + PermissionGuard", () => {
    const guards = guardsOf(AppsResolver);
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(PermissionGuard);
  });

  it("AppsResolver.apps → platform.apps.view", () => {
    expect(permsOf(AppsResolver.prototype, "apps")).toEqual([
      "platform.apps.view",
    ]);
  });
});
