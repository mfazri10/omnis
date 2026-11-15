import { BadRequestException, Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import type { PoolClient } from "pg";
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
  private controlPlanePool?: Pool;
  private controlPlaneDb?: Db;
  private readonly appPools = new Map<string, CachedPool>();
  private evictionTimer?: NodeJS.Timeout;

  private readonly evictionIntervalMs = 60_000;
  private readonly maxIdleMs = 600_000;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
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
    if (this.controlPlanePool) {
      await this.controlPlanePool.end();
    }
  }

  getControlPlaneConnection(): Db {
    return this.ensureControlPlane().db;
  }

  /**
   * Pinjam SATU koneksi control-plane untuk operasi session-level
   * (mis. advisory lock saga). Selalu release di finally.
   */
  async withControlPlaneClient<T>(
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.ensureControlPlane().pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  /** Operasi admin database (F03). Pool ephemeral, selalu di-end. */
  async databaseExists(dbName: string): Promise<boolean> {
    this.assertValidDbName(dbName);
    const pool = this.adminPool();
    try {
      const result = await pool.query(
        "SELECT 1 AS one FROM pg_database WHERE datname = $1",
        [dbName],
      );
      return result.rows.length > 0;
    } finally {
      await pool.end();
    }
  }

  async createDatabase(dbName: string): Promise<void> {
    this.assertValidDbName(dbName);
    const pool = this.adminPool();
    try {
      await pool.query(`CREATE DATABASE "${dbName}"`);
    } finally {
      await pool.end();
    }
  }

  async dropDatabaseIfExists(dbName: string): Promise<void> {
    this.assertValidDbName(dbName);
    const pool = this.adminPool();
    try {
      await pool.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [dbName],
      );
      await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    } finally {
      await pool.end();
    }
  }

  /** Koneksi drizzle sekali-pakai ke satu App DB (mis. migrasi template). */
  async withAppDbConnection<T>(
    dbName: string,
    fn: (db: Db) => Promise<T>,
  ): Promise<T> {
    this.assertValidDbName(dbName);
    const base = this.config.getOrThrow<string>("POSTGRES_BASE_URL");
    const pool = new Pool({
      connectionString: `${base}/${dbName}`,
      max: 2,
      connectionTimeoutMillis: 5_000,
    });
    try {
      return await fn(drizzle(pool));
    } finally {
      await pool.end();
    }
  }

  /** Tutup + buang pool cache satu aplikasi (mis. saat suspend). */
  async closeAppPool(slug: string): Promise<boolean> {
    const cached = this.appPools.get(slug);
    if (!cached) {
      return false;
    }
    await cached.pool.end();
    this.appPools.delete(slug);
    return true;
  }

  /**
   * Lazy init: factory provider (mis. AUTH) berjalan sebelum onModuleInit,
   * sehingga pool control-plane dibuat saat pertama dipakai, bukan saat init.
   */
  private ensureControlPlane(): { pool: Pool; db: Db } {
    if (!this.controlPlanePool || !this.controlPlaneDb) {
      const pool = new Pool({
        connectionString: this.config.getOrThrow<string>(
          "CONTROL_PLANE_DB_URL",
        ),
        min: 5,
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
      this.controlPlanePool = pool;
      this.controlPlaneDb = drizzle(pool);
    }
    return { pool: this.controlPlanePool, db: this.controlPlaneDb };
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
    const controlPlanePool = this.ensureControlPlane().pool;
    let totalServerConnections = controlPlanePool.totalCount;
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
        total: controlPlanePool.totalCount,
        idle: controlPlanePool.idleCount,
        waiting: controlPlanePool.waitingCount,
      },
      appPools: { count: this.appPools.size, pools },
      totalServerConnections,
    };
  }

  private adminPool(): Pool {
    const base = this.config.getOrThrow<string>("POSTGRES_BASE_URL");
    return new Pool({
      connectionString: `${base}/postgres`,
      max: 2,
      connectionTimeoutMillis: 5_000,
    });
  }

  private assertValidDbName(dbName: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
      throw new BadRequestException("Nama database tidak valid.");
    }
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
    const result = await this.getControlPlaneConnection().execute(
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
