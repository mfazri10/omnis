import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { of } from "rxjs";
import { DatabaseService } from "../../database/database.service";
import { APP_CONTEXT_KEY } from "../types/request-context";
import {
  APP_DB_KEY,
  AppDatabaseInterceptor,
} from "./app-database.interceptor";

function mockHttpContext(req: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function mockGqlContext(req: Record<string, unknown>): ExecutionContext {
  const handler = (): string => "ok";
  return {
    getType: () => "graphql",
    getHandler: () => handler,
    getClass: () => Object,
    getArgs: () => [{}, {}, { req }, {}],
    getContext: () => ({ req }),
  } as unknown as ExecutionContext;
}

async function makeInterceptor(): Promise<{
  interceptor: AppDatabaseInterceptor;
  getAppConnection: jest.Mock;
}> {
  const getAppConnection = jest.fn();
  const moduleRef = await Test.createTestingModule({
    providers: [
      AppDatabaseInterceptor,
      { provide: DatabaseService, useValue: { getAppConnection } },
    ],
  }).compile();
  return {
    interceptor: moduleRef.get(AppDatabaseInterceptor),
    getAppConnection,
  };
}

function mockHandler(): CallHandler {
  return { handle: () => of("ok") };
}

describe("AppDatabaseInterceptor", () => {
  it("konteks tervalidasi → resolve pool dari slug konteks", async () => {
    const { interceptor, getAppConnection } = await makeInterceptor();
    const pool = { tag: "pool-tes-cpns" };
    getAppConnection.mockResolvedValue(pool);
    const req: Record<string, unknown> = {
      [APP_CONTEXT_KEY]: { appId: "7", slug: "tes-cpns" },
    };
    await interceptor.intercept(mockGqlContext(req), mockHandler());
    expect(getAppConnection).toHaveBeenCalledWith("tes-cpns", {
      allowNonActive: true,
    });
    expect(req[APP_DB_KEY]).toBe(pool);
  });

  it("header mentah tanpa konteks → diabaikan", async () => {
    const { interceptor, getAppConnection } = await makeInterceptor();
    const req: Record<string, unknown> = {
      headers: { "x-app-slug": "tes-cpns" },
    };
    await interceptor.intercept(mockGqlContext(req), mockHandler());
    expect(getAppConnection).not.toHaveBeenCalled();
    expect(req[APP_DB_KEY]).toBeUndefined();
  });

  it("konteks non-GraphQL → teruskan", async () => {
    const { interceptor, getAppConnection } = await makeInterceptor();
    const req = {
      [APP_CONTEXT_KEY]: { appId: "7", slug: "tes-cpns" },
    };
    await interceptor.intercept(mockHttpContext(req), mockHandler());
    expect(getAppConnection).not.toHaveBeenCalled();
  });
});
