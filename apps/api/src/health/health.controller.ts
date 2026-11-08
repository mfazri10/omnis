import { Controller, Get, HttpCode } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service";
import { RedisService } from "../redis/redis.service";

type CheckStatus = "ok" | "degraded" | "down";

interface CheckResult {
  status: CheckStatus;
  responseTime?: number;
}

interface HealthResponse {
  status: CheckStatus;
  checks: Record<string, CheckResult>;
  uptime: number;
  version: string;
}

const DB_DEGRADED_MS = 500;
const REDIS_DEGRADED_MS = 200;

/** GET /health — publik, tanpa auth (doc 16 §2). Storage & worker menyusul fasenya. */
@Controller("health")
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @HttpCode(200)
  async check(): Promise<HealthResponse> {
    const controlPlaneDb = await this.checkDb();
    const redis = await this.checkRedis();

    const checks: Record<string, CheckResult> = { controlPlaneDb, redis };
    const statuses = Object.values(checks).map((c) => c.status);
    const status: CheckStatus = statuses.includes("down")
      ? "down"
      : statuses.includes("degraded")
        ? "degraded"
        : "ok";

    return {
      status,
      checks,
      uptime: Math.floor(process.uptime()),
      version: "0.0.0",
    };
  }

  private async checkDb(): Promise<CheckResult> {
    const started = Date.now();
    try {
      await this.db.getControlPlaneConnection().execute(sql`SELECT 1`);
      const responseTime = Date.now() - started;
      return {
        status: responseTime > DB_DEGRADED_MS ? "degraded" : "ok",
        responseTime,
      };
    } catch {
      return { status: "down" };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const started = Date.now();
    try {
      await this.redis.getClient().ping();
      const responseTime = Date.now() - started;
      return {
        status: responseTime > REDIS_DEGRADED_MS ? "degraded" : "ok",
        responseTime,
      };
    } catch {
      return { status: "down" };
    }
  }
}
