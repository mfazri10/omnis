# 12 — Strategi Migrasi Database

## 1. Masalah

Arsitektur multi-database (satu control-plane `platform` + satu `app_{slug}` per aplikasi — lihat [06-database-design.md](06-database-design.md)) menimbulkan tantangan migrasi yang tidak ada di arsitektur single-database:

1. **Skema template berubah, App DB sudah berjalan.** Ketika tabel `users`, `media`, atau `device_tokens` berubah (kolom baru, indeks, constraint), perubahan itu harus diterapkan bukan hanya ke App DB yang baru di-provision, tapi juga ke **seluruh App DB yang sudah ada**.
2. **Modul domain punya migrasi sendiri.** CBT menambahkan tabel soal; POS menambahkan tabel produk. Migrasi modul hanya relevan untuk App DB yang mengaktifkan modul itu.
3. **Jumlah database tumbuh seiring waktu.** Setiap aplikasi baru = satu database baru. Proses migrasi harus otomatis menemukan semua database dari registry, bukan daftar statis.

Dokumen ini mendefinisikan strategi, tooling, dan prosedur untuk mengatasi ketiga masalah tersebut.

## 2. Dua Jenis Migrasi

### 2.1 Control-Plane Migrations

Migrasi standar untuk database `platform`. Hanya satu database target; dijalankan saat deploy seperti aplikasi monolitik biasa.

| Aspek | Detail |
|---|---|
| Target | Database `platform` (satu) |
| Isi | Tabel `apps`, `admins`, `roles`, `permissions`, `activity_logs`, `notification_campaigns`, tabel better-auth, dsb. |
| Waktu jalan | Setiap deploy, sebelum aplikasi mulai menerima traffic |
| Folder | `migrations/platform/` |

### 2.2 App DB Migrations

Migrasi untuk setiap `app_{slug}`. Terdiri dari dua sub-kategori:

| Sub-kategori | Folder | Target |
|---|---|---|
| **Template migrations** | `migrations/app-template/` | Semua App DB tanpa kecuali (`users`, `media`, `device_tokens`, skema shared) |
| **Domain module migrations** | `migrations/app-cbt/`, `migrations/app-pos/`, `migrations/app-debat/`, … | Hanya App DB yang mengaktifkan modul tersebut |

Template migrations dan domain module migrations digabung menjadi satu set migrasi yang dijalankan berurutan ke setiap App DB sesuai modul yang aktif.

## 3. Migration Registry (`schema_migrations`)

Setiap database — baik `platform` maupun setiap `app_{slug}` — memiliki tabel `schema_migrations` yang mencatat migrasi yang sudah diterapkan.

### Skema Tabel

```sql
CREATE TABLE schema_migrations (
  id          bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        varchar(255) NOT NULL UNIQUE,
  checksum    varchar(64)  NOT NULL,
  executed_at timestamptz  NOT NULL DEFAULT now()
);
```

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | bigint PK | Auto-increment |
| `name` | varchar UNIQUE | Nama file migrasi, mis. `20260115143000_template_add_user_metadata` |
| `checksum` | varchar(64) | SHA-256 dari isi file migrasi; divalidasi setiap kali untuk mendeteksi file yang diubah setelah diterapkan |
| `executed_at` | timestamptz | Waktu eksekusi |

### Cara Kerja

1. Saat runner berjalan, ia membaca semua file migrasi dari folder yang relevan.
2. Membandingkan dengan `schema_migrations` di database target.
3. File yang belum ada di tabel = **pending**, dijalankan berurutan.
4. File yang sudah ada tapi checksum berbeda = **checksum mismatch**, runner berhenti dan melaporkan error.

## 4. Alur Migrasi Saat Deploy

```text
┌──────────────────────────────────────────────────────────────┐
│                    npm run migrate:all                        │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌─── Step 1 ───────────────────────────────────────────────────┐
│  Migrasi control-plane DB (platform)                         │
│  • Acquire advisory lock pada platform DB                    │
│  • Jalankan pending migrations dari migrations/platform/     │
│  • Release lock                                              │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌─── Step 2 ───────────────────────────────────────────────────┐
│  Query registry: SELECT slug, db_name FROM apps              │
│  WHERE status IN ('active','suspended')                      │
│  → Dapat daftar semua App DB yang terdaftar                  │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌─── Step 3 ───────────────────────────────────────────────────┐
│  Untuk setiap App DB (sequential atau parallel, configurable)│
│  ┌────────────────────────────────────────────────────────┐  │
│  │ a. Acquire advisory lock pada App DB                   │  │
│  │ b. Jalankan pending template migrations                │  │
│  │    (migrations/app-template/)                          │  │
│  │ c. Jalankan pending domain migrations sesuai modul     │  │
│  │    aktif (migrations/app-cbt/, app-pos/, dll.)         │  │
│  │ d. Release lock                                        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌─── Step 4 ───────────────────────────────────────────────────┐
│  Log hasil per DB:                                           │
│  • ✅ app_tes_cpns: 3 migrations applied                     │
│  • ✅ app_ngewarung: 0 pending (up to date)                  │
│  • ❌ app_debat: FAILED — checksum mismatch on ...           │
│                                                              │
│  Mode error handling (configurable via env):                 │
│  • MIGRATE_ON_ERROR=fail-fast  → berhenti di DB pertama     │
│                                   yang gagal                 │
│  • MIGRATE_ON_ERROR=continue   → lanjut ke DB berikutnya,   │
│                                   kumpulkan error, exit 1   │
└──────────────────────────────────────────────────────────────┘
```

### Variabel Konfigurasi

| Variable | Default | Deskripsi |
|---|---|---|
| `MIGRATE_ON_ERROR` | `fail-fast` | `fail-fast` atau `continue` |
| `MIGRATE_CONCURRENCY` | `1` | Jumlah App DB yang dimigrasi secara paralel; `1` = sequential |
| `MIGRATE_LOG_LEVEL` | `info` | Level log: `debug`, `info`, `warn`, `error` |

## 5. CLI Commands

### `npm run migrate:all`

Menjalankan alur lengkap (Step 1–4 di atas). Dipakai saat deploy dan di CI/CD pipeline.

```bash
# Jalankan semua migrasi (control-plane + semua App DB)
npm run migrate:all

# Dengan konfigurasi
MIGRATE_ON_ERROR=continue MIGRATE_CONCURRENCY=4 npm run migrate:all
```

### `npm run migrate:app -- --slug=<slug>`

Menjalankan migrasi hanya untuk satu App DB tertentu. Berguna untuk:
- Debugging migrasi yang gagal pada satu aplikasi.
- Menjalankan migrasi setelah provisioning manual.

```bash
# Migrasi hanya app_tes_cpns
npm run migrate:app -- --slug=tes-cpns
```

### `npm run migrate:status`

Menampilkan status migrasi semua database tanpa menjalankan apapun.

```bash
npm run migrate:status
```

Output contoh:

```text
Platform (platform):
  Total migrations: 12
  Applied: 12
  Pending: 0
  Status: ✅ up to date

App DB (app_tes_cpns):
  Template migrations: 5 applied, 1 pending
  CBT migrations: 8 applied, 0 pending
  Status: ⚠️ 1 pending

App DB (app_ngewarung):
  Template migrations: 5 applied, 1 pending
  POS migrations: 6 applied, 2 pending
  Status: ⚠️ 3 pending

App DB (app_debat):
  Template migrations: 5 applied, 1 pending
  Debat migrations: 4 applied, 0 pending
  Status: ⚠️ 1 pending
```

### `npm run migrate:create`

Helper untuk membuat file migrasi baru dengan nama sesuai konvensi.

```bash
# Buat migrasi template baru
npm run migrate:create -- --scope=app-template --name=add_user_preferences

# Buat migrasi modul CBT
npm run migrate:create -- --scope=app-cbt --name=add_question_tags

# Buat migrasi control-plane
npm run migrate:create -- --scope=platform --name=add_notification_templates
```

## 6. Konvensi Migrasi Baru

### Penamaan File

Format: `YYYYMMDDHHMMSS_<module>_<description>.ts`

Contoh:

| File | Scope |
|---|---|
| `20260115143000_platform_create_apps.ts` | Control-plane |
| `20260115150000_template_create_users.ts` | App template |
| `20260120100000_cbt_create_questions.ts` | Modul CBT |
| `20260125090000_pos_create_products.ts` | Modul POS |
| `20260201110000_debat_create_motions.ts` | Modul Debat |

Timestamp memastikan urutan eksekusi deterministik di semua database.

### Struktur Folder

```text
migrations/
├── platform/                          # Control-plane DB
│   ├── 20260115143000_platform_create_apps.ts
│   ├── 20260115143100_platform_create_admins.ts
│   ├── 20260115143200_platform_create_roles.ts
│   └── ...
├── app-template/                      # Semua App DB (shared schema)
│   ├── 20260115150000_template_create_users.ts
│   ├── 20260115150100_template_create_media.ts
│   ├── 20260115150200_template_create_device_tokens.ts
│   ├── 20260301120000_template_add_user_preferences.ts
│   └── ...
├── app-cbt/                           # App DB dengan modul CBT
│   ├── 20260120100000_cbt_create_questions.ts
│   ├── 20260120100100_cbt_create_packages.ts
│   └── ...
├── app-pos/                           # App DB dengan modul POS
│   ├── 20260125090000_pos_create_products.ts
│   └── ...
└── app-debat/                         # App DB dengan modul Debat
    ├── 20260201110000_debat_create_motions.ts
    └── ...
```

### Anatomi File Migrasi

Setiap file migrasi mengekspor dua fungsi: `up` dan `down`.

```typescript
import { sql } from 'drizzle-orm';
import type { MigrationContext } from '../runner';

export async function up({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN preferences jsonb DEFAULT '{}'::jsonb;
  `);
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`
    ALTER TABLE users
    DROP COLUMN preferences;
  `);
}
```

`MigrationContext` menyediakan instance `db` Drizzle yang sudah terhubung ke database target (bisa `platform` atau `app_{slug}` tertentu).

## 7. Rollback Strategy

| Aspek | Kebijakan |
|---|---|
| Down migrations | Setiap migrasi **wajib** memiliki fungsi `down` yang reversi perubahan `up` |
| Eksekusi rollback | Hanya **manual** — tidak ada rollback otomatis saat deploy gagal |
| Produksi | **Forward-fix** lebih dianjurkan: buat migrasi baru yang memperbaiki masalah, bukan rollback |
| Staging/development | Rollback manual diperbolehkan untuk iterasi cepat |

### CLI Rollback

```bash
# Rollback satu migrasi terakhir di control-plane
npm run migrate:down -- --scope=platform

# Rollback satu migrasi terakhir untuk satu App DB
npm run migrate:down -- --scope=app --slug=tes-cpns

# Rollback N migrasi
npm run migrate:down -- --scope=platform --steps=3
```

### Alasan Forward-Fix di Produksi

1. Rollback bisa kehilangan data (drop column, drop table).
2. Aplikasi lain mungkin sudah memakai skema baru — rollback satu DB memecahkan konsistensi.
3. Migrasi baru yang memperbaiki masalah tercatat dalam `schema_migrations`, memberikan audit trail yang jelas.

## 8. Safety: Advisory Lock & Validasi

### Advisory Lock per Database

Mencegah race condition ketika beberapa instance (CI runner, developer, proses deploy paralel) mencoba menjalankan migrasi pada database yang sama secara bersamaan.

```typescript
// Acquire exclusive advisory lock sebelum migrasi
const MIGRATION_LOCK_ID = 7364291; // angka tetap, unik untuk migrasi

async function withMigrationLock(
  db: DrizzleInstance,
  fn: () => Promise<void>,
): Promise<void> {
  // pg_advisory_lock memblokir sampai lock tersedia
  await db.execute(sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`);
  try {
    await fn();
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`);
  }
}
```

Setiap database memiliki ruang advisory lock sendiri, sehingga migrasi `app_tes_cpns` tidak memblokir migrasi `app_ngewarung`.

### Validasi Checksum

Sebelum menjalankan migrasi pending, runner memvalidasi semua migrasi yang sudah tercatat:

```text
Untuk setiap migrasi M yang ada di schema_migrations:
  1. Hitung SHA-256 dari file migrasi M saat ini
  2. Bandingkan dengan M.checksum di tabel
  3. Jika berbeda → abort, log:
     "Checksum mismatch: migration '{name}' has been modified after execution.
      Expected: {db_checksum}, Got: {file_checksum}"
```

Ini mencegah developer mengubah file migrasi yang sudah diterapkan — perubahan harus dibuat sebagai migrasi baru.

### Validasi Urutan

Runner juga memvalidasi bahwa tidak ada file migrasi baru yang memiliki timestamp **lebih awal** dari migrasi yang sudah diterapkan terakhir. Ini mencegah migrasi disisipkan retroaktif yang bisa menyebabkan urutan eksekusi berbeda antar database.

## 9. Integrasi Drizzle ORM

Drizzle ORM digunakan sebagai ORM utama (lihat [08-tech-stack.md](08-tech-stack.md)). Integrasi migrasi memanfaatkan Drizzle untuk dua hal: **definisi skema** dan **eksekusi SQL**.

### Skema sebagai Sumber Kebenaran

Drizzle schema files (`src/modules/**/entities/*.ts`) mendefinisikan tabel dalam TypeScript. Dari sini:

1. **Generate migrasi**: Drizzle Kit (`drizzle-kit generate`) membandingkan skema TypeScript dengan snapshot terakhir dan menghasilkan file SQL/TS.
2. **Custom runner**: Migrasi yang dihasilkan Drizzle Kit dijalankan oleh custom migration runner (bukan `drizzle-kit migrate`) karena kebutuhan multi-database.

### Konfigurasi Drizzle Kit per Scope

```typescript
// drizzle.config.platform.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/modules/platform/**/entities/*.ts',
  out: './migrations/platform',
  dialect: 'postgresql',
});
```

```typescript
// drizzle.config.app-template.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/modules/shared/**/entities/*.ts',  // users, media, device_tokens
  ],
  out: './migrations/app-template',
  dialect: 'postgresql',
});
```

```typescript
// drizzle.config.app-cbt.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/modules/cbt/**/entities/*.ts',
  out: './migrations/app-cbt',
  dialect: 'postgresql',
});
```

### Custom Migration Runner

Drizzle Kit bawaan hanya mengelola satu database. Custom runner menambahkan:

1. **Multi-database dispatch** — iterasi App DB dari registry.
2. **Advisory lock** — per database sebelum migrasi.
3. **Checksum validation** — verifikasi integritas file migrasi.
4. **Unified logging** — hasil migrasi semua database dalam satu output.

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function runAppMigrations(slug: string, dbName: string): Promise<MigrationResult> {
  const pool = new Pool({ database: dbName });
  const db = drizzle(pool);

  return withMigrationLock(db, async () => {
    // 1. Validasi checksum migrasi yang sudah diterapkan
    await validateChecksums(db, getAppliedMigrations(db));

    // 2. Jalankan template migrations
    const templateResults = await runPendingMigrations(db, 'migrations/app-template');

    // 3. Jalankan domain module migrations sesuai modul aktif
    const moduleResults = await runModuleMigrations(db, slug);

    return { slug, templateResults, moduleResults };
  });
}
```

### Generate Migrasi Baru

```bash
# Generate migrasi dari perubahan skema
npx drizzle-kit generate --config=drizzle.config.platform.ts
npx drizzle-kit generate --config=drizzle.config.app-template.ts
npx drizzle-kit generate --config=drizzle.config.app-cbt.ts

# Review file yang dihasilkan, rename sesuai konvensi jika perlu
# Lalu jalankan via custom runner
npm run migrate:all
```

## 10. Migrasi dalam Provisioning Aplikasi Baru

Ketika aplikasi baru di-provision (lihat [13-provisioning-saga.md](13-provisioning-saga.md)):

```text
provisionApp(nama, slug)
  │
  ├── 1. CREATE DATABASE app_{slug}
  ├── 2. Buat tabel schema_migrations
  ├── 3. Jalankan SEMUA template migrations (seolah DB baru)
  ├── 4. Jalankan SEMUA domain module migrations sesuai modul yang dipilih
  ├── 5. Insert record ke registry (apps) di control-plane
  └── 6. Gagal di tengah → DROP DATABASE + hapus registry (rollback saga)
```

Karena App DB baru mulai dari kosong, semua migrasi berstatus pending dan dijalankan berurutan. Hasilnya identik dengan App DB lama yang sudah menjalankan semua migrasi secara inkremental.

## 11. Referensi

- [06-database-design.md](06-database-design.md) — Skema control-plane dan template App DB
- [13-provisioning-saga.md](13-provisioning-saga.md) — Alur provisioning aplikasi baru (saga pattern)
- [05-arsitektur-sistem.md](05-arsitektur-sistem.md) — Arsitektur multi-database dan modul NestJS
- [08-tech-stack.md](08-tech-stack.md) — Drizzle ORM sebagai ORM rekomendasi
