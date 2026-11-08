import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import {
  AppNotFoundException,
  AppSuspendedException,
} from "../common/exceptions/app.exceptions";

export type Db = NodePgDatabase;

interface CachedPool {
  pool: Pool;
  db: Db;
  lastAccessedAt: number;
}

export interface PoolMetrics {
  total: number;
  idle: number;
  waiting: number;
}

interface AppRow {
  id: number;
  status: string;
}

/**
 * Connection factory multi-database (doc 11):
 * - Control-plane: satu pool tetap, selalu hidup.
 * - App DB: lazy pool per slug + eviction setelah 10 menit idle.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private controlPlanePool!: Pool;
  private controlPlaneDb!: Db;
  private readonly appPools = new Map<string, CachedPool>();
  private evictionTimer?: NodeJS.Timeout;

  private readonly evictionIntervalMs = 60_000;
  private readonly maxIdleMs = 600_000;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.controlPlanePool = new Pool({
      connectionString: this.config.getOrThrow<string>(
        "CONTROL_PLANE_DB_URL",
      ),
      min: 5,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.controlPlaneDb = drizzle(this.controlPlanePool);

    this.evictionTimer = setInterval(() => {
      void this.evictIdlePools();
    }, this.evictionIntervalMs);
    this.evictionTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
    }
    for (const [slug, cached] of this.appPools) {
      await cached.pool.end();
      this.appPools.delete(slug);
    }
    await this.controlPlanePool.end();
  }

  getControlPlaneConnection(): Db {
    return this.controlPlaneDb;
  }

  async getAppConnection(slug: string): Promise<Db> {
    const existing = this.appPools.get(slug);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      return existing.db;
    }

    await this.validateSlug(slug);

    const dbName = `app_${slug.replace(/-/g, "_")}`;
    const base = this.config.getOrThrow<string>("POSTGRES_BASE_URL");
    const pool = new Pool({
      connectionString: `${base}/${dbName}`,
      min: 2,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    const db = drizzle(pool);
    this.appPools.set(slug, { pool, db, lastAccessedAt: Date.now() });
    return db;
  }

  getPoolMetrics(): {
    controlPlane: PoolMetrics;
    appPools: { count: number; pools: Record<string, PoolMetrics> };
    totalServerConnections: number;
  } {
    const pools: Record<string, PoolMetrics> = {};
    let totalServerConnections = this.controlPlanePool.totalCount;
    for (const [slug, cached] of this.appPools) {
      pools[slug] = {
        total: cached.pool.totalCount,
        idle: cached.pool.idleCount,
        waiting: cached.pool.waitingCount,
      };
      totalServerConnections += cached.pool.totalCount;
    }
    return {
      controlPlane: {
        total: this.controlPlanePool.totalCount,
        idle: this.controlPlanePool.idleCount,
        waiting: this.controlPlanePool.waitingCount,
      },
      appPools: { count: this.appPools.size, pools },
      totalServerConnections,
    };
  }

  private async evictIdlePools(): Promise<void> {
    const now = Date.now();
    for (const [slug, cached] of this.appPools) {
      if (now - cached.lastAccessedAt > this.maxIdleMs) {
        await cached.pool.end();
        this.appPools.delete(slug);
      }
    }
  }

  private async validateSlug(slug: string): Promise<void> {
    const result = await this.controlPlaneDb.execute(
      sql`SELECT id, status FROM apps WHERE slug = ${slug} LIMIT 1`,
    );
    const rows = result.rows as unknown as AppRow[];
    const app = rows[0];
    if (!app) {
      throw new AppNotFoundException(slug);
    }
    if (app.status !== "active") {
      throw new AppSuspendedException(slug, app.status);
    }
  }
}
