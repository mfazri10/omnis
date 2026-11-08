import type { NextFunction, Request, Response } from "express";
import type Redis from "ioredis";

interface RateRule {
  name: string;
  windowSeconds: number;
  max: number;
}

const RULES: Array<{ prefix: string; rule: RateRule }> = [
  {
    prefix: "/sign-in",
    rule: { name: "signin", windowSeconds: 60, max: 5 },
  },
  {
    prefix: "/request-password-reset",
    rule: { name: "forgot", windowSeconds: 300, max: 3 },
  },
  // Aturan default untuk endpoint /api/auth/* lainnya.
  { prefix: "/", rule: { name: "auth", windowSeconds: 60, max: 120 } },
];

// Endpoint better-auth yang tidak boleh diakses publik — lifecycle akun
// admin hanya lewat seed, CMS (F05), dan skrip terkendali.
const BLOCKED_PREFIXES = [
  "/sign-up",
  "/delete-user",
  "/change-email",
];

function matchRule(path: string): RateRule {
  for (const { prefix, rule } of RULES) {
    if (path === prefix || path.startsWith(`${prefix}/`) || prefix === "/") {
      if (prefix !== "/" && !path.startsWith(prefix)) {
        continue;
      }
      return rule;
    }
  }
  return RULES[RULES.length - 1]?.rule ?? { name: "auth", windowSeconds: 60, max: 120 };
}

function isBlocked(path: string): boolean {
  return BLOCKED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

async function checkLimit(
  redis: Redis,
  rule: RateRule,
  ip: string,
): Promise<{ limited: boolean; retryAfter: number }> {
  const key = `ratelimit:${rule.name}:${ip}`;
  const now = Date.now();
  const windowStart = now - rule.windowSeconds * 1000;
  const countPipeline = redis.pipeline();
  countPipeline.zremrangebyscore(key, 0, windowStart);
  countPipeline.zcard(key);
  const countResults = await countPipeline.exec();
  const count = Number(countResults?.[1]?.[1] ?? 0);

  if (count >= rule.max) {
    const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
    const oldestScore = Number(oldest[1] ?? now);
    const retryAfter = Math.max(
      1,
      Math.ceil((oldestScore + rule.windowSeconds * 1000 - now) / 1000),
    );
    return { limited: true, retryAfter };
  }

  const member = `${now}-${Math.random().toString(36).slice(2)}`;
  const addPipeline = redis.pipeline();
  addPipeline.zadd(key, now, member);
  addPipeline.expire(key, rule.windowSeconds + 1);
  await addPipeline.exec();
  return { limited: false, retryAfter: 0 };
}

/**
 * Rate limit sliding window (Redis) untuk /api/auth/* — limit mengikuti
 * doc 16 §1.2, respons 429 mengikuti doc 16 §1.3.
 *
 * Dipakai sebagai middleware Express (bukan guard Nest) karena endpoint
 * better-auth ditangani satu mounted handler, bukan controller.
 * Redis mati = fail-open (diloloskan + warning), bukan fail-closed.
 *
 * Klien di-resolve per-request via getter: main.ts memasang middleware ini
 * sebelum app.init()/listen(), sehingga capture langsung akan mengunci
 * undefined (RedisService.onModuleInit belum jalan).
 */
export function createAuthRateLimit(getRedis: () => Redis) {
  return async function authRateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (isBlocked(req.path)) {
      res.status(403).json({
        statusCode: 403,
        message: "Endpoint ini dinonaktifkan. Kelola akun admin lewat CMS.",
      });
      return;
    }
    try {
      const { limited, retryAfter } = await checkLimit(
        getRedis(),
        matchRule(req.path),
        req.ip ?? "unknown",
      );
      if (limited) {
        res.setHeader("Retry-After", String(retryAfter));
        res.status(429).json({
          statusCode: 429,
          message: `Too many requests. Try again in ${retryAfter} seconds.`,
          retryAfter,
        });
        return;
      }
    } catch (error: unknown) {
      console.warn(
        "[rate-limit] Redis tidak tersedia, permintaan diloloskan.",
        error,
      );
    }
    next();
  };
}
