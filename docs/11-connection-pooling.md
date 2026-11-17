# 11 — Strategi Connection Pooling

## 1. Masalah

PostgreSQL memiliki batas bawaan `max_connections = 100`. Pada arsitektur multi-database platform ini, setiap App DB (`app_{slug}`) membutuhkan pool koneksi terpisah karena masing-masing merupakan database berbeda di server yang sama.

Perhitungan cepat:

- Control-plane DB (`platform`): 1 pool, misal max 20 koneksi.
- Setiap App DB: 1 pool, misal max 5 koneksi.
- 20 aplikasi → 20 × 5 = 100 koneksi App DB + 20 koneksi control-plane = **120 koneksi**. Sudah melampaui batas default.

Jika semua pool dibuka sekaligus dan idle, koneksi tetap ditahan server. Ditambah koneksi dari worker BullMQ, migrasi, dan monitoring — server cepat kehabisan slot.

**Kesimpulan**: tanpa strategi pooling yang tepat, platform tidak bisa melampaui ~15 aplikasi di server Postgres tunggal dengan konfigurasi default.

## 2. Connection Factory

### 2.1 Prinsip Desain

| Jenis koneksi | Strategi pool | Alasan |
|---|---|---|
| Control-plane DB (`platform`) | **Pool tetap** — selalu terhubung | Setiap request butuh data platform (auth, RBAC, registry); latensi cold-start tidak diterima |
| App DB (`app_{slug}`) | **Lazy pool** — dibuat saat slug pertama kali diakses, di-cache di `Map` | Tidak semua aplikasi aktif bersamaan; menghemat koneksi |

### 2.2 Konfigurasi Pool

| Parameter | Control-plane | App DB (per slug) |
|---|---|---|
| `min` (idle minimum) | 5 | 2 |
| `max` (koneksi maksimum) | 20 | 5 |
| `idleTimeoutMillis` | 30 000 ms | 30 000 ms |
| `connectionTimeoutMillis` | 5 000 ms | 5 000 ms |

### 2.3 Idle Eviction untuk App DB

Pool App DB yang **tidak diakses selama lebih dari 10 menit** akan ditutup dan dihapus dari cache `Map`. Tujuannya mengembalikan koneksi ke server Postgres agar bisa dipakai pool lain.

Mekanisme:
- Setiap akses ke pool App DB memperbarui timestamp `lastAccessedAt`.
- Interval pengecekan (`evictionIntervalMs`) berjalan setiap 60 detik.
- Pool dengan `Date.now() - lastAccessedAt > 600_000` ditutup (`pool.end()`), lalu entry dihapus dari `Map`.
- Akses berikutnya ke slug yang sama akan membuat pool baru (lazy).

## 3. `DatabaseModule` NestJS

### 3.1 Struktur Modul

`DatabaseModule` adalah modul global (`@Global()`) yang menyediakan `DatabaseService` sebagai single provider. Modul ini diimpor sekali di `AppModule`.

```text
DatabaseModule (@Global)
  └─ DatabaseService
       ├─ controlPlanePool        (Pool — selalu hidup)
       ├─ appPools                (Map<string, CachedPool>)
       ├─ getControlPlaneConnection()
       ├─ getAppConnection(slug)
       └─ eviction interval       (cleanup pool idle)
```

### 3.2 API `DatabaseService`

#### `getControlPlaneConnection(): DrizzleInstance`

- Selalu tersedia sejak `onModuleInit`.
- Mengembalikan instance Drizzle yang terikat ke pool control-plane.
- Tidak pernah di-evict.

#### `getAppConnection(slug: string, options?: { allowNonActive?: boolean }): Promise<DrizzleInstance>`

1. Cek `appPools.has(slug)` — jika ada, perbarui `lastAccessedAt`, kembalikan instance.
2. Jika tidak ada: validasi slug terhadap registry `apps` di control-plane (harus ada; status `active` kecuali `allowNonActive`).
3. Buat pool baru dengan connection string `postgresql://…/app_{normalized_slug}`.
4. Inisialisasi Drizzle instance di atas pool tersebut.
5. Simpan ke `appPools` dengan `lastAccessedAt = Date.now()`.
6. Kembalikan instance.

Validasi eksistensi mencegah pembuatan pool ke database yang tidak ada. Keputusan AKSES (status + hak admin) milik `AppContextGuard` (F02), bukan lapisan pool: interceptor selalu memanggil dengan `allowNonActive: true` karena konteksnya sudah tervalidasi guard (termasuk suspended untuk Super Admin); jalur langsung lain tetap ditolak untuk aplikasi non-active.

### 3.3 Interceptor `AppDatabaseInterceptor`

Interceptor global yang otomatis resolve koneksi App DB dari konteks tervalidasi `AppContextGuard` dan inject ke request context, sehingga resolver/service tidak perlu memanggil `getAppConnection()` secara manual. Header mentah tidak pernah dibaca di sini.

```text
Request masuk (guard sudah jalan: Auth → AppContext → Permission)
  → AppDatabaseInterceptor membaca req[APP_CONTEXT_KEY]
  → Jika ada konteks tervalidasi:
      → panggil DatabaseService.getAppConnection(slug, { allowNonActive: true })
      → simpan DrizzleInstance ke GqlExecutionContext / request object
  → Jika tidak ada konteks: skip (operasi global)
  → Handler / resolver mengambil koneksi dari context
```

## 4. Kode Contoh

### 4.1 `DatabaseService`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

interface CachedPool {
  pool: Pool;
  db: NodePgDatabase;
  lastAccessedAt: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private controlPlanePool: Pool;
  private controlPlaneDb: NodePgDatabase;
  private readonly appPools = new Map<string, CachedPool>();
  private evictionTimer: NodeJS.Timeout;

  private readonly EVICTION_INTERVAL_MS = 60_000;
  private readonly MAX_IDLE_MS = 600_000; // 10 menit

  async onModuleInit() {
    // Pool tetap untuk control-plane
    this.controlPlanePool = new Pool({
      connectionString: process.env.CONTROL_PLANE_DB_URL,
      min: 5,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.controlPlaneDb = drizzle(this.controlPlanePool);

    // Mulai eviction interval
    this.evictionTimer = setInterval(
      () => this.evictIdlePools(),
      this.EVICTION_INTERVAL_MS,
    );
  }

  async onModuleDestroy() {
    clearInterval(this.evictionTimer);
    // Tutup semua pool App DB
    for (const [slug, cached] of this.appPools) {
      await cached.pool.end();
      this.appPools.delete(slug);
    }
    // Tutup pool control-plane
    await this.controlPlanePool.end();
  }

  getControlPlaneConnection(): NodePgDatabase {
    return this.controlPlaneDb;
  }

  async getAppConnection(slug: string): Promise<NodePgDatabase> {
    const existing = this.appPools.get(slug);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      return existing.db;
    }

    // Validasi slug dari registry di control-plane
    await this.validateSlug(slug);

    const normalizedDbName = `app_${slug.replace(/-/g, '_')}`;
    const pool = new Pool({
      connectionString: this.buildConnectionString(normalizedDbName),
      min: 2,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    const db = drizzle(pool);

    this.appPools.set(slug, {
      pool,
      db,
      lastAccessedAt: Date.now(),
    });

    return db;
  }

  /** Pool App DB yang idle > 10 menit ditutup */
  private async evictIdlePools() {
    const now = Date.now();
    for (const [slug, cached] of this.appPools) {
      if (now - cached.lastAccessedAt > this.MAX_IDLE_MS) {
        await cached.pool.end();
        this.appPools.delete(slug);
      }
    }
  }

  private async validateSlug(slug: string): Promise<void> {
    const result = await this.controlPlaneDb.execute(
      `SELECT id, status FROM apps WHERE slug = '${slug}' LIMIT 1`,
    );
    // Gunakan parameterized query di implementasi nyata
    const app = result.rows[0];
    if (!app) {
      throw new Error(`App with slug "${slug}" not found`);
    }
    if (app.status !== 'active') {
      throw new Error(`App "${slug}" is ${app.status}`);
    }
  }

  private buildConnectionString(dbName: string): string {
    const base = process.env.POSTGRES_BASE_URL;
    // Contoh base: postgresql://user:pass@localhost:5432
    return `${base}/${dbName}`;
  }
}
```

### 4.2 `AppDatabaseInterceptor`

```typescript
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { DatabaseService } from './database.service';

export const APP_DB_KEY = 'appDb';

@Injectable()
export class AppDatabaseInterceptor implements NestInterceptor {
  constructor(private readonly databaseService: DatabaseService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const gqlCtx = GqlExecutionContext.create(context);
    const req = gqlCtx.getContext().req;
    const slug = req.headers['x-app-slug'] as string | undefined;

    if (slug) {
      const appDb = await this.databaseService.getAppConnection(slug);
      req[APP_DB_KEY] = appDb;
    }

    return next.handle();
  }
}
```

### 4.3 Penggunaan di Resolver

```typescript
import { Resolver, Query, Context } from '@nestjs/graphql';
import { APP_DB_KEY } from './app-database.interceptor';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { questions } from './schema';

@Resolver()
export class CbtResolver {
  @Query(() => [Question])
  async listQuestions(@Context() ctx: any) {
    const appDb: NodePgDatabase = ctx.req[APP_DB_KEY];
    return appDb.select().from(questions);
  }
}
```

### 4.4 `DatabaseModule`

```typescript
import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseService } from './database.service';
import { AppDatabaseInterceptor } from './app-database.interceptor';

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AppDatabaseInterceptor,
    },
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
```

## 5. PgBouncer

### 5.1 Kapan Dibutuhkan

PgBouncer direkomendasikan saat jumlah aplikasi **melebihi 30**. Pada titik itu, walaupun dengan lazy pool dan idle eviction, puncak koneksi bersamaan bisa melebihi `max_connections` PostgreSQL yang sudah di-tune (misalnya 200).

PgBouncer bertindak sebagai connection multiplexer di depan Postgres: banyak koneksi dari aplikasi NestJS dipetakan ke sejumlah kecil koneksi nyata ke server database.

### 5.2 Mode Transaction Pooling

Gunakan mode **transaction** — koneksi server Postgres hanya dipegang selama transaksi aktif, lalu dikembalikan ke pool PgBouncer. Mode ini paling efisien untuk workload web/API.

**Batasan mode transaction:**
- `LISTEN/NOTIFY` tidak bisa dipakai (tidak relevan untuk platform ini).
- Prepared statements harus dikelola oleh PgBouncer (≥ 1.21 mendukung `prepared_statement_count`).
- `SET` per-session tidak persisten antar query — Drizzle tidak bergantung padanya.

### 5.3 Konfigurasi PgBouncer

```ini
; pgbouncer.ini

[databases]
platform = host=postgres port=5432 dbname=platform
; App DB di-route wildcard — semua database yang belum match di atas
; diarahkan ke server Postgres yang sama
* = host=postgres port=5432

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

pool_mode = transaction
max_client_conn = 400
default_pool_size = 20
min_pool_size = 2
reserve_pool_size = 5
reserve_pool_timeout = 3
server_idle_timeout = 300
server_lifetime = 3600
log_connections = 0
log_disconnections = 0
```

### 5.4 Deployment di Docker Compose

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    # max_connections dinaikkan karena PgBouncer mengelola sisi klien
    command: postgres -c max_connections=200

  pgbouncer:
    image: bitnami/pgbouncer:latest
    depends_on:
      - postgres
    environment:
      PGBOUNCER_DATABASE: "*"
      POSTGRESQL_HOST: postgres
      POSTGRESQL_PORT: 5432
      POSTGRESQL_USERNAME: ${POSTGRES_USER}
      POSTGRESQL_PASSWORD: ${POSTGRES_PASSWORD}
      PGBOUNCER_POOL_MODE: transaction
      PGBOUNCER_MAX_CLIENT_CONN: 400
      PGBOUNCER_DEFAULT_POOL_SIZE: 20
    ports:
      - "6432:6432"

  api:
    build: ./api
    depends_on:
      - pgbouncer
      - redis
    environment:
      # Semua koneksi melewati PgBouncer, bukan langsung ke Postgres
      CONTROL_PLANE_DB_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@pgbouncer:6432/platform
      POSTGRES_BASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@pgbouncer:6432
      REDIS_URL: redis://redis:6379

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

Saat PgBouncer aktif, konfigurasi pool di `DatabaseService` bisa dilonggarkan (max per App DB dinaikkan ke 10) karena PgBouncer yang membatasi koneksi nyata ke server Postgres.

## 6. Tabel Kapasitas

Estimasi koneksi berdasarkan jumlah aplikasi. Asumsi: semua App DB sedang aktif bersamaan (worst case), control-plane pool max 20, worker BullMQ 3 koneksi, monitoring 2 koneksi.

### 6.1 Tanpa PgBouncer (koneksi langsung)

| Jumlah aplikasi | Koneksi App DB (max 5/app) | Control-plane | Worker + monitoring | **Total koneksi** | Status vs `max_connections` |
|---:|---:|---:|---:|---:|---|
| 5 | 25 | 20 | 5 | **50** | ✅ Aman (default 100) |
| 10 | 50 | 20 | 5 | **75** | ✅ Aman (default 100) |
| 20 | 100 | 20 | 5 | **125** | ⚠️ Perlu naikkan ke 150+ |
| 50 | 250 | 20 | 5 | **275** | ❌ Tidak layak tanpa PgBouncer |

> Dengan **idle eviction** (pool ditutup setelah 10 menit tidak aktif), angka aktual saat runtime jauh lebih rendah. Tabel di atas menunjukkan worst case.

### 6.2 Dengan PgBouncer (transaction pooling)

PgBouncer mendaur ulang koneksi server antar transaksi. Rasio multiplexing tipikal untuk workload API: **5:1** (5 koneksi klien berbagi 1 koneksi server).

| Jumlah aplikasi | Koneksi klien (dari NestJS) | Koneksi server nyata (estimasi) | Status vs `max_connections=200` |
|---:|---:|---:|---|
| 5 | 50 | ~15 | ✅ Sangat aman |
| 10 | 75 | ~25 | ✅ Sangat aman |
| 20 | 125 | ~40 | ✅ Aman |
| 50 | 275 | ~70 | ✅ Aman |
| 100 | 525 | ~130 | ⚠️ Pertimbangkan naikkan `max_connections` |

## 7. Monitoring

### 7.1 Metrik Pool yang Harus Dipantau

| Metrik | Sumber | Deskripsi |
|---|---|---|
| `pool_active_connections` | `Pool.totalCount` (pg) | Jumlah koneksi aktif (sedang digunakan) per database |
| `pool_idle_connections` | `Pool.idleCount` (pg) | Koneksi idle di pool per database |
| `pool_waiting_requests` | `Pool.waitingCount` (pg) | Request yang antri menunggu koneksi tersedia |
| `pool_total_count` | Agregat | Total koneksi aktif + idle di seluruh pool |
| `app_pools_count` | `appPools.size` | Jumlah pool App DB yang sedang terbuka |
| `eviction_count` | Counter internal | Jumlah pool yang di-evict karena idle |

### 7.2 Endpoint Metrik

Sediakan endpoint internal (HTTP GET `/metrics/db-pool`) yang mengembalikan status pool. Contoh output:

```json
{
  "controlPlane": {
    "total": 12,
    "idle": 7,
    "waiting": 0
  },
  "appPools": {
    "count": 8,
    "pools": {
      "tes-cpns": { "total": 4, "idle": 2, "waiting": 0 },
      "ngewarung": { "total": 3, "idle": 1, "waiting": 0 }
    }
  },
  "totalServerConnections": 40
}
```

### 7.3 Alert

| Kondisi | Severity | Aksi |
|---|---|---|
| `waiting > 0` pada pool mana pun selama > 30 detik | **Warning** | Periksa query lambat; pertimbangkan naikkan `max` pool |
| `waiting > 5` pada pool mana pun | **Critical** | Pool exhausted — ada bottleneck query atau spike traffic |
| `totalServerConnections` > 80% `max_connections` | **Warning** | Pertimbangkan PgBouncer atau naikkan `max_connections` |
| `totalServerConnections` > 95% `max_connections` | **Critical** | Risiko connection refused; eskalasi segera |
| Pool App DB gagal dibuat (connection error) | **Error** | Database mungkin belum di-provision atau server down |

### 7.4 Implementasi Metrik di `DatabaseService`

```typescript
interface PoolMetrics {
  total: number;
  idle: number;
  waiting: number;
}

// Tambahkan method di DatabaseService
getPoolMetrics(): Record<string, any> {
  const appPoolMetrics: Record<string, PoolMetrics> = {};
  let totalServerConnections = this.controlPlanePool.totalCount;

  for (const [slug, cached] of this.appPools) {
    appPoolMetrics[slug] = {
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
    appPools: {
      count: this.appPools.size,
      pools: appPoolMetrics,
    },
    totalServerConnections,
  };
}
```

## 8. Referensi

- [05 — Arsitektur Sistem](05-arsitektur-sistem.md): arsitektur multi-database, peran `DatabaseModule` sebagai connection factory, alur request app-scoped yang bergantung pada header `X-App-Slug`.
- [08 — Tech Stack](08-tech-stack.md): stack terkunci (PostgreSQL multi-database, NestJS, Redis + BullMQ) dan rekomendasi Drizzle ORM yang mendukung koneksi dinamis multi-DB.
- [06 — Desain Database](06-database-design.md): skema control-plane + template App DB, konvensi penamaan database `app_{slug}`.
