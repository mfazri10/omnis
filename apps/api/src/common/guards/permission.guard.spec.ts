import type { ExecutionContext } from "@nestjs/common";
import {
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { RbacService } from "../../modules/platform/rbac/rbac.service";
import { RequirePermissions } from "../decorators/require-permissions.decorator";
import { APP_CONTEXT_KEY } from "../types/request-context";
import { ADMIN_KEY } from "./auth.guard";
import { PermissionGuard } from "./permission.guard";

const ADMIN = {
  id: "11",
  authUserId: "u11",
  name: "Operator",
  email: "op@contoh.id",
  isSuperAdmin: false,
};

class LockedController {
  @RequirePermissions("platform.roles.manage")
  locked(this: void): string {
    return "ok";
  }

  open(this: void): string {
    return "ok";
  }
}

type Handler = () => string;

function mockContext(
  req: Record<string, unknown>,
  handler: Handler,
): ExecutionContext {
  return {
    getType: () => "http",
    getHandler: () => handler,
    getClass: () => LockedController,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

async function makeGuard(): Promise<{
  guard: PermissionGuard;
  hasPermission: jest.Mock;
}> {
  const hasPermission = jest.fn();
  const moduleRef = await Test.createTestingModule({
    providers: [
      PermissionGuard,
      Reflector,
      { provide: RbacService, useValue: { hasPermission } },
    ],
  }).compile();
  return { guard: moduleRef.get(PermissionGuard), hasPermission };
}

describe("PermissionGuard (HTTP)", () => {
  it("lolos tanpa metadata permission", async () => {
    const { guard, hasPermission } = await makeGuard();
    const context = mockContext(
      { [ADMIN_KEY]: ADMIN },
      LockedController.prototype.open,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it("meneruskan profil super ke service (bypass milik service)", async () => {
    const { guard, hasPermission } = await makeGuard();
    hasPermission.mockResolvedValue(true);
    const context = mockContext(
      { [ADMIN_KEY]: { ...ADMIN, isSuperAdmin: true } },
      LockedController.prototype.locked,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(
      { id: "11", isSuperAdmin: true },
      "platform.roles.manage",
      undefined,
    );
  });

  it("lolos bila punya permission", async () => {
    const { guard, hasPermission } = await makeGuard();
    hasPermission.mockResolvedValue(true);
    const context = mockContext(
      { [ADMIN_KEY]: ADMIN },
      LockedController.prototype.locked,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(
      { id: "11", isSuperAdmin: false },
      "platform.roles.manage",
      undefined,
    );
  });

  it("menolak tanpa izin + membawa requiredPermission", async () => {
    const { guard, hasPermission } = await makeGuard();
    hasPermission.mockResolvedValue(false);
    const context = mockContext(
      { [ADMIN_KEY]: ADMIN },
      LockedController.prototype.locked,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    try {
      await guard.canActivate(context);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        requiredPermission: "platform.roles.manage",
      });
      return;
    }
    throw new Error("seharusnya melempar ForbiddenException");
  });

  it("tanpa profil admin → Unauthorized", async () => {
    const { guard } = await makeGuard();
    const context = mockContext({}, LockedController.prototype.locked);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("meneruskan appId konteks ke service", async () => {
    const { guard, hasPermission } = await makeGuard();
    hasPermission.mockResolvedValue(true);
    const context = mockContext(
      {
        [ADMIN_KEY]: ADMIN,
        [APP_CONTEXT_KEY]: { appId: "7", slug: "tes-cpns" },
      },
      LockedController.prototype.locked,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(
      { id: "11", isSuperAdmin: false },
      "platform.roles.manage",
      "7",
    );
  });

  it("tanpa konteks → appId undefined", async () => {
    const { guard, hasPermission } = await makeGuard();
    hasPermission.mockResolvedValue(true);
    const context = mockContext(
      { [ADMIN_KEY]: ADMIN },
      LockedController.prototype.locked,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(
      { id: "11", isSuperAdmin: false },
      "platform.roles.manage",
      undefined,
    );
  });
});
