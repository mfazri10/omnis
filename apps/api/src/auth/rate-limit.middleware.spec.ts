import type { NextFunction, Request, Response } from "express";
import type Redis from "ioredis";
import { createAuthRateLimit } from "./rate-limit.middleware";

type ExecResult = Array<[null, unknown]>;

function makeRedis(count: number): {
  redis: Redis;
  exec: jest.Mock;
  getPipelineCount: () => number;
} {
  let pipelineCount = 0;
  const exec = jest.fn();
  const redis = {
    pipeline: jest.fn().mockImplementation(() => {
      pipelineCount += 1;
      return {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec,
      };
    }),
    zrange: jest.fn().mockResolvedValue(["member", String(Date.now())]),
  } as unknown as Redis;
  exec.mockResolvedValue([[null, 0], [null, count]] as ExecResult);
  return { redis, exec, getPipelineCount: () => pipelineCount };
}

function makeReq(path: string): Request {
  return { path, ip: "127.0.0.1" } as unknown as Request;
}

function makeRes(): {
  res: Response;
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
} {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn().mockReturnThis();
  const setHeader = jest.fn();
  const res = { status, json, setHeader } as unknown as Response;
  return { res, status, json, setHeader };
}

function makeNext(): { next: NextFunction; called: jest.Mock } {
  const called = jest.fn();
  return { next: called, called };
}

describe("createAuthRateLimit", () => {
  it("resolve klien secara lazy: aman dibuat sebelum Redis init", async () => {
    const holder: { current?: Redis } = {};
    const getRedis = jest.fn((): Redis => {
      if (!holder.current) {
        throw new Error("Redis belum init");
      }
      return holder.current;
    });
    const middleware = createAuthRateLimit(getRedis);
    expect(getRedis).not.toHaveBeenCalled();

    const { redis, getPipelineCount } = makeRedis(0);
    holder.current = redis;
    const { res } = makeRes();
    const { next, called } = makeNext();
    await middleware(makeReq("/sign-in/email"), res, next);

    expect(getRedis).toHaveBeenCalled();
    expect(getPipelineCount()).toBeGreaterThan(0);
    expect(called).toHaveBeenCalled();
  });

  it("429 + Retry-After saat limit sign-in tercapai", async () => {
    const { redis } = makeRedis(5);
    const middleware = createAuthRateLimit(() => redis);
    const { res, status, setHeader } = makeRes();
    const { next, called } = makeNext();
    await middleware(makeReq("/sign-in/email"), res, next);

    expect(status).toHaveBeenCalledWith(429);
    expect(setHeader).toHaveBeenCalledWith(
      "Retry-After",
      expect.any(String),
    );
    expect(called).not.toHaveBeenCalled();
  });

  it("403 untuk endpoint terblokir tanpa menyentuh Redis", async () => {
    const getRedis = jest.fn();
    const middleware = createAuthRateLimit(getRedis);
    const { res, status } = makeRes();
    const { next, called } = makeNext();
    await middleware(makeReq("/sign-up/email"), res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(getRedis).not.toHaveBeenCalled();
    expect(called).not.toHaveBeenCalled();
  });
});
