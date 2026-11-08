# 15 — Strategi Testing

## 1. Masalah Utama

Arsitektur multi-database (satu control-plane DB `platform` + satu App DB `app_{slug}` per aplikasi — lihat [06-database-design.md](06-database-design.md)) membuat test setup lebih kompleks dibandingkan aplikasi single-database:

- Setiap test yang melibatkan App DB membutuhkan database terpisah agar tidak terjadi tabrakan state antar test.
- Provisioning logic (CREATE DATABASE → migrasi template → migrasi modul) harus ikut dijalankan di test environment.
- Koneksi dinamis per slug (`DatabaseModule` — lihat [05-arsitektur-sistem.md](05-arsitektur-sistem.md)) perlu di-wire ulang ke test database.
- Redis + BullMQ harus tersedia untuk E2E test yang melibatkan notifikasi terjadwal.

Dokumen ini menetapkan konvensi agar test tetap terisolasi, cepat, dan reliable meski arsitekturnya multi-database.

## 2. Jenis Test

| Jenis | Scope | Database | Contoh |
|---|---|---|---|
| **Unit** (`*.spec.ts`) | Service / resolver logic murni | Mock / stub | Kalkulasi skor CBT, validasi input, transformasi DTO, permission-key matching |
| **Integration** (`*.integration.spec.ts`) | Modul + database nyata | Real DB (test instance) | CRUD soal di App DB, provisioning aplikasi baru, audit log creation |
| **E2E** (`*.e2e.spec.ts`) | Full API flow (GraphQL endpoint) | Real DB + Redis | Login → pilih app → buat soal → cek permission → verifikasi audit log |

### Naming Convention

```text
src/
  cbt/
    services/
      cbt-question.service.ts
      cbt-question.service.spec.ts              # unit
      cbt-question.service.integration.spec.ts  # integration
  test/
    cbt/
      cbt-flow.e2e.spec.ts                      # e2e
    helpers/
      test-db.ts                                # createTestAppDb, dropTestAppDb
      seed.ts                                   # seed functions
      auth-context.ts                           # asAdmin, asRole
    jest-e2e.config.ts
```

## 3. Test Database Setup

### 3.1 Control-Plane Test DB

Database `platform_test` — dibuat **sekali** sebelum seluruh test suite berjalan, dimigrasi dengan skema control-plane yang sama persis.

```typescript
// test/helpers/test-db.ts

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";

const PG_CONNECTION = process.env.TEST_PG_CONNECTION ?? "postgres://localhost:5432";

/**
 * Dipanggil sekali di globalSetup Jest.
 * Membuat platform_test jika belum ada dan menjalankan migrasi control-plane.
 */
export async function setupControlPlaneTestDb(): Promise<void> {
  const client = new Client({ connectionString: `${PG_CONNECTION}/postgres` });
  await client.connect();

  const exists = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = 'platform_test'`,
  );
  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE platform_test`);
  }
  await client.end();

  const pool = new Pool({ connectionString: `${PG_CONNECTION}/platform_test` });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "drizzle/control-plane" });
  await pool.end();
}
```

### 3.2 App DB Test: `app_test_{random}`

Setiap test suite/file yang membutuhkan App DB membuat database unik lalu men-drop-nya setelah selesai. Nama menggunakan suffix random agar bisa berjalan paralel.

```typescript
// test/helpers/test-db.ts (lanjutan)

import { randomBytes } from "node:crypto";

interface TestAppDb {
  slug: string;
  dbName: string;
  pool: Pool;
  db: ReturnType<typeof drizzle>;
}

/**
 * Membuat App DB test unik, menjalankan migrasi template + modul.
 */
export async function createTestAppDb(
  modules: string[] = [],
): Promise<TestAppDb> {
  const suffix = randomBytes(4).toString("hex");
  const slug = `test_${suffix}`;
  const dbName = `app_test_${suffix}`;

  const rootClient = new Client({ connectionString: `${PG_CONNECTION}/postgres` });
  await rootClient.connect();
  await rootClient.query(`CREATE DATABASE "${dbName}"`);
  await rootClient.end();

  const pool = new Pool({ connectionString: `${PG_CONNECTION}/${dbName}` });
  const db = drizzle(pool);

  // Migrasi template (users, media, device_tokens)
  await migrate(db, { migrationsFolder: "drizzle/app-template" });

  // Migrasi modul domain yang diminta
  for (const mod of modules) {
    await migrate(db, { migrationsFolder: `drizzle/app-modules/${mod}` });
  }

  return { slug, dbName, pool, db };
}

/**
 * Drop App DB test setelah suite selesai.
 */
export async function dropTestAppDb(testAppDb: TestAppDb): Promise<void> {
  await testAppDb.pool.end();

  const rootClient = new Client({ connectionString: `${PG_CONNECTION}/postgres` });
  await rootClient.connect();
  await rootClient.query(`DROP DATABASE IF EXISTS "${testAppDb.dbName}"`);
  await rootClient.end();
}
```

### 3.3 Global Setup / Teardown (Jest)

```typescript
// jest.globalSetup.ts
import { setupControlPlaneTestDb } from "./test/helpers/test-db";

export default async function globalSetup() {
  await setupControlPlaneTestDb();
}
```

## 4. Fixture Strategy

### 4.1 Seed Functions per Modul

Setiap modul menyediakan seed function yang idempoten dan mandiri. Seed mengembalikan entity yang dibuat agar test bisa langsung mereferensikannya.

```typescript
// test/helpers/seed.ts

import { InferInsertModel } from "drizzle-orm";
import { admins, apps, roles, permissions, rolePermissions } from "@/schema/control-plane";

export async function seedAdmin(
  db: ControlPlaneDb,
  overrides: Partial<InferInsertModel<typeof admins>> = {},
) {
  const [admin] = await db
    .insert(admins)
    .values({
      full_name: "Test Admin",
      email: `admin_${randomBytes(4).toString("hex")}@test.local`,
      status: "active",
      ...overrides,
    })
    .returning();
  return admin;
}

export async function seedApp(
  db: ControlPlaneDb,
  overrides: Partial<InferInsertModel<typeof apps>> = {},
) {
  const slug = overrides.slug ?? `app_${randomBytes(4).toString("hex")}`;
  const [app] = await db
    .insert(apps)
    .values({
      name: "Test App",
      slug,
      status: "active",
      db_name: `app_${slug.replace(/-/g, "_")}`,
      ...overrides,
    })
    .returning();
  return app;
}

export async function seedRole(
  db: ControlPlaneDb,
  appId: number,
  permissionKeys: string[] = [],
) {
  const [role] = await db
    .insert(roles)
    .values({ app_id: appId, name: `role_${randomBytes(4).toString("hex")}` })
    .returning();

  if (permissionKeys.length > 0) {
    const perms = await db
      .select()
      .from(permissions)
      .where(inArray(permissions.key, permissionKeys));

    await db.insert(rolePermissions).values(
      perms.map((p) => ({ role_id: role.id, permission_id: p.id })),
    );
  }

  return role;
}

export async function seedCbtQuestions(
  db: AppDb,
  count: number = 5,
) {
  const questions = Array.from({ length: count }, (_, i) => ({
    text: `Pertanyaan test #${i + 1}`,
    type: "multiple_choice" as const,
    options: JSON.stringify(["A", "B", "C", "D"]),
    answer_key: "A",
  }));

  return db.insert(cbtQuestions).values(questions).returning();
}
```

### 4.2 Isolasi State: Tidak Share Antar Test File

Setiap test suite bertanggung jawab atas data-nya sendiri. Tidak ada shared global seed yang bermutasi lintas file.

```typescript
// cbt-question.service.integration.spec.ts

describe("CbtQuestionService (integration)", () => {
  let testAppDb: TestAppDb;
  let platformPool: Pool;

  beforeAll(async () => {
    platformPool = new Pool({ connectionString: `${PG_CONNECTION}/platform_test` });
    testAppDb = await createTestAppDb(["cbt"]);
  });

  afterAll(async () => {
    await dropTestAppDb(testAppDb);
    await platformPool.end();
  });

  it("should create a question", async () => {
    // test logic menggunakan testAppDb.db
  });
});
```

### 4.3 Transaction Rollback untuk Unit/Integration Test

Untuk mempercepat test dan menjaga isolasi antar test case dalam satu file, bungkus setiap test dalam transaction lalu rollback.

```typescript
// test/helpers/test-db.ts (lanjutan)

import { sql } from "drizzle-orm";

/**
 * Menjalankan callback dalam transaction yang selalu di-rollback.
 * Data yang dibuat di dalam callback tidak pernah ter-commit.
 */
export async function withRollback<T>(
  db: ReturnType<typeof drizzle>,
  fn: (tx: ReturnType<typeof drizzle>) => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx);
      throw new RollbackSignal();
    });
  } catch (e) {
    if (!(e instanceof RollbackSignal)) throw e;
  }
  return result!;
}

class RollbackSignal extends Error {
  constructor() {
    super("rollback");
  }
}
```

Penggunaan:

```typescript
it("should update question text", async () => {
  await withRollback(testAppDb.db, async (tx) => {
    const [q] = await seedCbtQuestions(tx, 1);
    await service.update(tx, q.id, { text: "Updated" });
    const updated = await service.findById(tx, q.id);
    expect(updated.text).toBe("Updated");
  });
  // data otomatis rollback, test berikutnya mulai bersih
});
```

## 5. Test Permission / RBAC

### 5.1 Helper Context

Helper `asAdmin` dan `asRole` mensimulasikan execution context tanpa melewati auth flow sungguhan. Mereka membuat objek konteks yang sama dengan yang dihasilkan guard di runtime.

```typescript
// test/helpers/auth-context.ts

import { ExecutionContext } from "@/types";

/**
 * Simulasi konteks admin (tanpa role/permission tertentu).
 * Cocok untuk test resolver yang hanya cek "apakah admin aktif".
 */
export function asAdmin(adminId: number): ExecutionContext {
  return {
    admin: { id: adminId, status: "active" },
    permissions: [],
    appSlug: null,
  };
}

/**
 * Simulasi konteks admin dengan role + permission tertentu pada suatu aplikasi.
 * Cocok untuk test resolver yang dicek oleh PermissionGuard.
 */
export function asRole(
  adminId: number,
  roleName: string,
  appSlug: string,
  permissionKeys: string[],
): ExecutionContext {
  return {
    admin: { id: adminId, status: "active" },
    permissions: permissionKeys,
    appSlug,
  };
}
```

### 5.2 Aturan Wajib: Setiap Resolver Minimal 2 Test Permission

Setiap resolver yang dilindungi `PermissionGuard` **wajib** memiliki minimal:

1. **1 test "ditolak tanpa permission"** — context tidak punya permission yang dibutuhkan → expect error/forbidden.
2. **1 test "berhasil dengan permission"** — context memiliki permission yang tepat → expect sukses.

```typescript
describe("CbtQuestionResolver", () => {
  describe("createQuestion", () => {
    it("should reject when admin lacks cbt.question.create permission", async () => {
      const ctx = asRole(1, "viewer", "tes-cpns", ["cbt.question.read"]);
      await expect(resolver.createQuestion(ctx, input)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should create question when admin has cbt.question.create permission", async () => {
      const ctx = asRole(1, "editor", "tes-cpns", [
        "cbt.question.read",
        "cbt.question.create",
      ]);
      const result = await resolver.createQuestion(ctx, input);
      expect(result.id).toBeDefined();
    });
  });
});
```

## 6. Mocking Boundaries

### Apa yang di-mock

| Layer | Di-mock? | Alasan |
|---|---|---|
| External services: FCM, S3, email transaksional | ✅ Ya | Tidak bisa dipanggil di CI; side-effect nyata tidak diinginkan |
| Third-party HTTP calls | ✅ Ya | Flaky, rate-limited |
| Database (Postgres) di integration/E2E test | ❌ **Tidak pernah** | Harus memvalidasi query, migrasi, constraint sungguhan |
| Redis di E2E test | ❌ Tidak | BullMQ queue behavior harus diverifikasi end-to-end |
| Database di unit test | ✅ Ya | Unit test hanya menguji logic, bukan query |

### Contoh Mock External Service

```typescript
// test/helpers/mock-services.ts

export function mockFcmService() {
  return {
    send: jest.fn().mockResolvedValue({ successCount: 1, failureCount: 0 }),
    sendMulticast: jest.fn().mockResolvedValue({ successCount: 10, failureCount: 0 }),
  };
}

export function mockS3Service() {
  return {
    getSignedUploadUrl: jest.fn().mockResolvedValue("https://s3.test/upload?signed=1"),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };
}

export function mockEmailService() {
  return {
    send: jest.fn().mockResolvedValue({ messageId: "test-msg-id" }),
  };
}
```

## 7. CI Pipeline

### 7.1 Docker Compose untuk Test Environment

```yaml
# docker-compose.test.yml

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: platform_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data  # RAM disk, lebih cepat

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
```

### 7.2 Parallel Test dengan DB Prefix per Worker

Jest `--shard` atau `--workerIdleMemoryLimit` menjalankan test paralel. Setiap worker mendapat prefix database sendiri agar tidak bentrok.

```typescript
// jest.globalSetup.ts

export default async function globalSetup() {
  // JEST_WORKER_ID tersedia per worker (1, 2, 3, ...)
  const workerId = process.env.JEST_WORKER_ID ?? "1";
  const platformDbName = `platform_test_${workerId}`;

  process.env.TEST_PLATFORM_DB = platformDbName;

  await setupControlPlaneTestDb(platformDbName);
}
```

```typescript
// test/helpers/test-db.ts — disesuaikan untuk parallel

export async function setupControlPlaneTestDb(
  dbName: string = "platform_test",
): Promise<void> {
  const client = new Client({ connectionString: `${PG_CONNECTION}/postgres` });
  await client.connect();

  const exists = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName],
  );
  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
  }
  await client.end();

  const pool = new Pool({ connectionString: `${PG_CONNECTION}/${dbName}` });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "drizzle/control-plane" });
  await pool.end();
}
```

App DB test sudah menggunakan suffix random (`app_test_{random}`), sehingga otomatis aman di parallel tanpa perlu prefix tambahan.

### 7.3 CI Script

```yaml
# .github/workflows/test.yml (relevan steps)

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd="pg_isready"
          --health-interval=5s
          --health-timeout=3s
          --health-retries=5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd="redis-cli ping"
          --health-interval=5s
          --health-timeout=3s
          --health-retries=5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm test -- --shard=${{ strategy.matrix.shard }}
        env:
          TEST_PG_CONNECTION: postgres://test:test@localhost:5432
          TEST_REDIS_URL: redis://localhost:6379
      - run: pnpm test:e2e
        env:
          TEST_PG_CONNECTION: postgres://test:test@localhost:5432
          TEST_REDIS_URL: redis://localhost:6379

    strategy:
      matrix:
        shard: ["1/3", "2/3", "3/3"]
```

### 7.4 Coverage Target

| Layer | Target | Keterangan |
|---|---|---|
| Service layer | **≥ 80%** | Logic inti bisnis, wajib tercakup |
| Resolver layer | ≥ 70% | Sebagian besar ditutupi oleh integration + E2E |
| Guard / middleware | ≥ 90% | Kritis untuk keamanan, semua branch harus diuji |
| Utility / helper | ≥ 70% | Fungsi murni, mudah diuji |

Konfigurasi di `jest.config.ts`:

```typescript
// jest.config.ts (coverage excerpt)
{
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    "./src/**/services/**": {
      branches: 75,
      functions: 80,
      lines: 80,
    },
    "./src/**/guards/**": {
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
}
```

## 8. Ringkasan Aturan

| # | Aturan |
|---|---|
| 1 | File naming: `*.spec.ts` (unit), `*.integration.spec.ts` (integration), `*.e2e.spec.ts` (E2E) |
| 2 | Unit test mock database; integration/E2E test **tidak pernah** mock database |
| 3 | External services (FCM, S3, email) **selalu** di-mock di semua jenis test |
| 4 | Setiap test suite yang butuh App DB membuat DB sendiri (`createTestAppDb`) dan men-drop setelah selesai (`dropTestAppDb`) |
| 5 | Tidak ada shared mutable state antar test file — setiap suite seed data sendiri |
| 6 | Unit/integration test menggunakan transaction rollback untuk isolasi antar test case |
| 7 | Setiap resolver yang dilindungi `PermissionGuard` wajib punya ≥ 1 test ditolak + ≥ 1 test berhasil |
| 8 | CI menjalankan Postgres + Redis via Docker; parallel worker mendapat DB prefix sendiri |
| 9 | Coverage ≥ 80% untuk service layer; CI gagal bila di bawah threshold |

## Referensi

- [05-arsitektur-sistem.md](05-arsitektur-sistem.md) — arsitektur multi-database, `DatabaseModule`, alur request app-scoped
- [06-database-design.md](06-database-design.md) — skema control-plane (`platform`) dan template App DB (`app_{slug}`)
