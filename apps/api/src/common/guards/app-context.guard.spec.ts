import type { ExecutionContext } from "@nestjs/common";
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { DatabaseService } from "../../database/database.service";
import type { AppRow, AppStatus } from "../../modules/platform/entities/apps.entity";
import { AppsRepository } from "../../modules/platform/apps/apps.repository";
import type { AssignmentRow } from "../../modules/platform/rbac/assignments.repository";
import { AssignmentsRepository } from "../../modules/platform/rbac/assignments.repository";
import {
  AppNotFoundException,
  AppSuspendedException,
} from "../exceptions/app.exceptions";
import { APP_CONTEXT_KEY } from "../types/request-context";
import { ADMIN_KEY } from "./auth.guard";
import { AppContextGuard } from "./app-context.guard";
import { AppScoped } from "../decorators/app-scoped.decorator";

const ADMIN = {
  id: "11",
  authUserId: "u11",
  name: "Operator",
  email: "op@contoh.id",
  isSuperAdmin: false,
};

function appRow(status: AppStatus): AppRow {
  return {
    id: 7,
    name: "Tes CPNS",
    slug: "tes-cpns",
    iconMediaUrl: null,
    status,
    dbName: "app_tes_cpns",
    androidPackage: null,
    iosBundleId: null,
    storeUrlAndroid: null,
    storeUrlIos: null,
    fcmCredential: null,
    notes: null,
    failureReason: null,
    lastProvisioningAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function grant(
  overrides: Partial<AssignmentRow> = {},
): AssignmentRow {
  return {
    roleId: 3,
    appId: 7,
    scopeType: "app",
    roleAppId: 7,
    ...overrides,
  };
}

class ScopedController {
  @AppScoped()
  scoped(this: void): string {
    return "ok";
  }

  open(this: void): string {
    return "ok";
  }
}

type Handler = () => string;

function mockHttpContext(
  req: Record<string, unknown>,
  handler: Handler,
): ExecutionContext {
  return {
    getType: () => "http",
    getHandler: () => handler,
    getClass: () => ScopedController,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function mockGqlContext(
  req: Record<string, unknown>,
  handler: Handler,
): ExecutionContext {
  return {
    getType: () => "graphql",
    getHandler: () => handler,
    getClass: () => ScopedController,
    getArgs: () => [{}, {}, { req }, {}],
    getContext: () => ({ req }),
  } as unknown as ExecutionContext;
}

async function makeGuard(): Promise<{
  guard: AppContextGuard;
  findBySlug: jest.Mock;
  listByAdmin: jest.Mock;
}> {
  const findBySlug = jest.fn();
  const listByAdmin = jest.fn();
  const moduleRef = await Test.createTestingModule({
    providers: [
      AppContextGuard,
      Reflector,
      {
        provide: DatabaseService,
        useValue: { getControlPlaneConnection: jest.fn() },
      },
      { provide: AppsRepository, useValue: { findBySlug } },
      { provide: AssignmentsRepository, useValue: { listByAdmin } },
    ],
  }).compile();
  return { guard: moduleRef.get(AppContextGuard), findBySlug, listByAdmin };
}

function scopedReq(
  slug: string | undefined,
  admin: Record<string, unknown> = ADMIN,
): Record<string, unknown> {
  return {
    [ADMIN_KEY]: admin,
    headers: slug === undefined ? {} : { "x-app-slug": slug },
  };
}

describe("AppContextGuard", () => {
  it("tanpa marker @AppScoped → lolos meski header ada", async () => {
    const { guard, findBySlug } = await makeGuard();
    const context = mockHttpContext(
      scopedReq("tes-cpns"),
      ScopedController.prototype.open,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findBySlug).not.toHaveBeenCalled();
  });

  it("marker + header hilang → BadRequest", async () => {
    const { guard } = await makeGuard();
    const context = mockHttpContext(
      scopedReq(undefined),
      ScopedController.prototype.scoped,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      "Konteks aplikasi wajib diisi (header X-App-Slug).",
    );
  });

  it("slug fiktif → AppNotFound", async () => {
    const { guard, findBySlug } = await makeGuard();
    findBySlug.mockResolvedValue(null);
    const context = mockHttpContext(
      scopedReq("asing"),
      ScopedController.prototype.scoped,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });

  it("non-super + suspended → AppSuspended", async () => {
    const { guard, findBySlug } = await makeGuard();
    findBySlug.mockResolvedValue(appRow("suspended"));
    const context = mockHttpContext(
      scopedReq("tes-cpns"),
      ScopedController.prototype.scoped,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      AppSuspendedException,
    );
  });

  it.each(["archived", "provisioning", "failed"] as AppStatus[])(
    "non-super + %s → AppSuspended",
    async (status: AppStatus) => {
      const { guard, findBySlug } = await makeGuard();
      findBySlug.mockResolvedValue(appRow(status));
      const context = mockHttpContext(
        scopedReq("tes-cpns"),
        ScopedController.prototype.scoped,
      );
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        AppSuspendedException,
      );
    },
  );

  it("non-super tanpa grant → Forbidden", async () => {
    const { guard, findBySlug, listByAdmin } = await makeGuard();
    findBySlug.mockResolvedValue(appRow("active"));
    listByAdmin.mockResolvedValue([]);
    const context = mockHttpContext(
      scopedReq("tes-cpns"),
      ScopedController.prototype.scoped,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      "Anda tidak memiliki akses ke aplikasi ini.",
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("super admin + suspended → lolos", async () => {
    const { guard, findBySlug, listByAdmin } = await makeGuard();
    findBySlug.mockResolvedValue(appRow("suspended"));
    const context = mockHttpContext(
      scopedReq("tes-cpns", { ...ADMIN, isSuperAdmin: true }),
      ScopedController.prototype.scoped,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(listByAdmin).not.toHaveBeenCalled();
  });

  it("super admin + archived → AppSuspended", async () => {
    const { guard, findBySlug } = await makeGuard();
    findBySlug.mockResolvedValue(appRow("archived"));
    const context = mockHttpContext(
      scopedReq("tes-cpns", { ...ADMIN, isSuperAdmin: true }),
      ScopedController.prototype.scoped,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      AppSuspendedException,
    );
  });

  it("grant global → lolos", async () => {
    const { guard, findBySlug, listByAdmin } = await makeGuard();
    findBySlug.mockResolvedValue(appRow("active"));
    listByAdmin.mockResolvedValue([
      grant({ appId: null, scopeType: "global", roleAppId: null }),
    ]);
    const context = mockHttpContext(
      scopedReq("tes-cpns"),
      ScopedController.prototype.scoped,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("grant app pada aplikasi itu → lolos; grant app lain → tolak", async () => {
    const { guard, findBySlug, listByAdmin } = await makeGuard();
    findBySlug.mockResolvedValue(appRow("active"));
    listByAdmin.mockResolvedValue([grant({ appId: 9, roleAppId: 9 })]);
    const context = mockHttpContext(
      scopedReq("tes-cpns"),
      ScopedController.prototype.scoped,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    listByAdmin.mockResolvedValue([grant({ appId: 7, roleAppId: 7 })]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("sukses menulis konteks tervalidasi ke request", async () => {
    const { guard, findBySlug, listByAdmin } = await makeGuard();
    findBySlug.mockResolvedValue(appRow("active"));
    listByAdmin.mockResolvedValue([grant({})]);
    const req = scopedReq("tes-cpns");
    const context = mockHttpContext(req, ScopedController.prototype.scoped);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req[APP_CONTEXT_KEY]).toEqual({
      appId: "7",
      slug: "tes-cpns",
      name: "Tes CPNS",
      status: "active",
      dbName: "app_tes_cpns",
    });
  });

  it("tanpa profil admin → Unauthorized", async () => {
    const { guard } = await makeGuard();
    const context = mockHttpContext(
      { headers: { "x-app-slug": "tes-cpns" } },
      ScopedController.prototype.scoped,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("id admin korup → Unauthorized", async () => {
    const { guard, findBySlug } = await makeGuard();
    findBySlug.mockResolvedValue(appRow("active"));
    const context = mockHttpContext(
      scopedReq("tes-cpns", { ...ADMIN, id: "bukan-angka" }),
      ScopedController.prototype.scoped,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("jalur GraphQL membaca header + menulis konteks", async () => {
    const { guard, findBySlug, listByAdmin } = await makeGuard();
    findBySlug.mockResolvedValue(appRow("active"));
    listByAdmin.mockResolvedValue([grant({})]);
    const req = scopedReq("tes-cpns");
    const context = mockGqlContext(req, ScopedController.prototype.scoped);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req[APP_CONTEXT_KEY]).toMatchObject({ slug: "tes-cpns" });
  });
});
