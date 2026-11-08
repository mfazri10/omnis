import type { ExecutionContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../../auth/auth.service";
import { ADMIN_KEY, AuthGuard } from "./auth.guard";

interface MockedContext {
  context: ExecutionContext;
  req: Record<string, unknown>;
}

describe("AuthGuard (HTTP)", () => {
  const admin = {
    id: "1",
    authUserId: "u1",
    name: "Admin",
    email: "a@contoh.id",
    isSuperAdmin: true,
  };

  function mockContext(headers: unknown): MockedContext {
    const req: Record<string, unknown> = { headers };
    const context = {
      getType: () => "http",
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { context, req };
  }

  async function makeGuard(verified: unknown): Promise<AuthGuard> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: AuthService,
          useValue: { verifySession: jest.fn().mockResolvedValue(verified) },
        },
      ],
    }).compile();
    return moduleRef.get(AuthGuard);
  }

  it("meloloskan sesi valid dan menempelkan admin", async () => {
    const guard = await makeGuard({ admin, userId: "u1" });
    const { context, req } = mockContext({ cookie: "sesi" });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req[ADMIN_KEY]).toEqual(admin);
  });

  it("menolak sesi tidak valid", async () => {
    const guard = await makeGuard(null);
    const { context } = mockContext({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
