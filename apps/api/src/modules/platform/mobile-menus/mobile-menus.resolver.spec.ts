import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../../common/decorators/app-scoped.decorator";
import { PERMISSIONS_KEY } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import type { AppContext } from "../../../common/types/request-context";
import type { ActivityLogService } from "../activity-logs/activity-log.service";
import type { AdminProfile } from "../admins/admins.service";
import type { MobileMenuRow } from "../entities/mobile-menus.entity";
import { PLATFORM_CATALOG } from "../rbac/platform.permissions";
import { MobileMenusService } from "./mobile-menus.service";
import { MobileMenusResolver } from "./mobile-menus.resolver";

const reflector = new Reflector();

const APP_CONTEXT: AppContext = {
  appId: "7",
  slug: "tes-cpns",
  name: "Tes CPNS",
  status: "active",
  dbName: "app_tes_cpns",
};

const ADMIN: AdminProfile = {
  id: "11",
  authUserId: "auth-11",
  name: "Operator",
  email: "operator@example.test",
  isSuperAdmin: false,
};

function menuRow(over: Partial<MobileMenuRow> = {}): MobileMenuRow {
  return {
    id: 21,
    appId: 7,
    name: "Beranda",
    slug: "beranda",
    routeKey: "home",
    iconKey: "home",
    parentId: null,
    orderNo: 0,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

function permsOf(target: object, method: string): string[] | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[method];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<string[]>(PERMISSIONS_KEY, fn);
}

function scopedOf(target: object, method: string): boolean | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[method];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<boolean>(APP_SCOPED_KEY, fn);
}

function makeResolver(): {
  resolver: MobileMenusResolver;
  service: {
    list: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  activityLog: { record: jest.Mock };
} {
  const service = {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const activityLog = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  return {
    resolver: new MobileMenusResolver(
      service as unknown as MobileMenusService,
      activityLog as unknown as ActivityLogService,
    ),
    service,
    activityLog,
  };
}

describe("MobileMenusResolver metadata", () => {
  it("uses auth, app context, and permission guards in order", () => {
    expect(Reflect.getMetadata("__guards__", MobileMenusResolver)).toEqual([
      AuthGuard,
      AppContextGuard,
      PermissionGuard,
    ]);
  });

  it.each([
    ["mobileMenus", "platform.mobile-menus.view"],
    ["createMobileMenu", "platform.mobile-menus.create"],
    ["updateMobileMenu", "platform.mobile-menus.update"],
    ["deleteMobileMenu", "platform.mobile-menus.delete"],
  ])("%s requires %s and is app-scoped", (method, permission) => {
    expect(permsOf(MobileMenusResolver.prototype, method)).toEqual([
      permission,
    ]);
    expect(scopedOf(MobileMenusResolver.prototype, method)).toBe(true);
  });
});

describe("MobileMenusResolver operations", () => {
  it("uses validated app context for the list query", async () => {
    const { resolver, service } = makeResolver();

    await resolver.mobileMenus(APP_CONTEXT);

    expect(service.list).toHaveBeenCalledWith("7");
  });

  it("creates and audits a menu with app, actor, and client IP", async () => {
    const { resolver, service, activityLog } = makeResolver();
    const row = menuRow();
    const input = { name: "Beranda", slug: "beranda" };
    service.create.mockResolvedValue(row);

    await resolver.createMobileMenu(APP_CONTEXT, input, ADMIN, "192.0.2.10");

    expect(service.create).toHaveBeenCalledWith("7", input);
    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "11",
      appId: "7",
      action: "create",
      entityType: "mobile_menu",
      entityId: "21",
      summary: "Membuat menu mobile Beranda",
      ip: "192.0.2.10",
    });
  });

  it("updates and audits using the current app context", async () => {
    const { resolver, service, activityLog } = makeResolver();
    const row = menuRow({ name: "Materi" });
    const input = { id: "21", name: "Materi" };
    service.update.mockResolvedValue(row);

    await resolver.updateMobileMenu(APP_CONTEXT, input, ADMIN, null);

    expect(service.update).toHaveBeenCalledWith("7", "21", input);
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "11",
        appId: "7",
        action: "update",
        entityType: "mobile_menu",
        entityId: "21",
        summary: "Mengubah menu mobile Materi",
        ip: null,
      }),
    );
  });

  it("deletes and audits using the current app context", async () => {
    const { resolver, service, activityLog } = makeResolver();
    service.delete.mockResolvedValue(menuRow());

    await expect(
      resolver.deleteMobileMenu(APP_CONTEXT, "21", ADMIN, "192.0.2.11"),
    ).resolves.toBe(true);

    expect(service.delete).toHaveBeenCalledWith("7", "21");
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "11",
        appId: "7",
        action: "delete",
        entityType: "mobile_menu",
        entityId: "21",
        summary: "Menghapus menu mobile Beranda",
        ip: "192.0.2.11",
      }),
    );
  });

  it("does not audit a mutation when the service rejects it", async () => {
    const { resolver, service, activityLog } = makeResolver();
    const error = new Error("forbidden");
    service.create.mockRejectedValue(error);

    await expect(
      resolver.createMobileMenu(
        APP_CONTEXT,
        { name: "Beranda", slug: "beranda" },
        ADMIN,
        null,
      ),
    ).rejects.toBe(error);
    expect(activityLog.record).not.toHaveBeenCalled();
  });
});

describe("mobile-menu app-role permission", () => {
  it("exposes create as an app-scoped catalog permission", () => {
    const permission = PLATFORM_CATALOG.find(
      ({ key }) => key === "platform.mobile-menus.create",
    );

    expect(permission?.globalOnly).toBe(false);
  });
});
