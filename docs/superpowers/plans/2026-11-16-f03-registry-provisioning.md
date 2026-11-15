# F03 Registry & Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi baru bisa didaftarkan dan diprovisioning (database + migrasi + config awal) dari CMS dalam satu alur saga yang aman, dengan retry/cleanup eksplisit saat gagal.

**Architecture:** Saga provisioning di `ProvisioningService` (lock advisory per-slug, langkah 2–7 doc 13, kompensasi LIFO, registry dipertahankan `failed`); operasi DB admin terpusat di `DatabaseService`; migrasi template App DB dipakai-ulang via runner; kredensial FCM terenkripsi AES-256-GCM; CMS mengelola registry + aksi status.

**Tech Stack:** NestJS 11 + GraphQL code-first, Drizzle ORM + drizzle-kit, PostgreSQL 16 (CREATEDB), Redis, Next.js 16 + Apollo Client v4, Jest + ts-jest, node:crypto.

**Spec:** `features/F03-registry-provisioning.md` (+ `docs/13-provisioning-saga.md` hasil rekonsiliasi, `docs/06-database-design.md`, `docs/07-api-design.md` §1–2, `pattern/backend-pattern.md` §2–3)

## Global Constraints

- TypeScript `strict: true`, tanpa `any`; import tipe via `import type`; return type eksplisit di service & repository.
- ID GraphQL string (`ID` scalar); kolom DB `bigint`; tulis `String(row.id)`, baca via parse + validasi (`NaN` → `BAD_USER_INPUT`).
- Waktu ISO-8601 UTC; DB `snake_case`; file `kebab-case`; pesan error Bahasa Indonesia.
- Alur Resolver → Service → Repository; repository stateless, argumen pertama `Db`; tanpa query Drizzle di service/resolver.
- Pagination: `PaginationArgs` (`skip`/`take`, `take` ≤ 50) + `{ items, totalCount }`.
- Exception NestJS saja (filter global memetakan `extensions.code`, termasuk `CONFLICT`).
- SEMUA decorator GraphQL wajib tipe eksplisit (`@Field(() => String)`, `@Args("x", { type: () => Y })`) — bun tak memancarkan `design:type`.
- Semua perintah `bun` di PowerShell sandbox diawali blok ini (cwd = root repo kecuali dinyatakan lain):
  ```powershell
  $wk = 'C:\Users\F-PC\Desktop\Project\manajemen-aplikasi-mobile'; $env:TEMP = "$wk\.tmp"; $env:TMP = "$wk\.tmp"; $env:TMPDIR = "$wk\.tmp"; $env:BUN_INSTALL_CACHE_DIR = "$wk\.bun-cache"
  ```
- Tes API: `bun run test -- <spec>` dari `apps/api`. Gerbang penuh: `bun run typecheck && bun run lint && bun run test && bun run build` dari root. Setiap gerbang WAJIB guard `if ($LASTEXITCODE -ne 0) { throw ... }`.
- Tidak ada kerja di branch main/master; push oleh manusia.

## Review Focus

1. Dua `provisionApp` slug sama bersamaan → tepat satu aplikasi; satunya `ConflictException` (lock), bukan dua baris/duplikat DB.
2. `retryProvisionApp` pada app active/suspended → `BadRequest`, TIDAK me-reprovision (uji: status tetap, DB tak tersentuh).
3. Suspend dengan pool hangat → `getAppConnection` berikutnya melempar walau pool sempat ada (bukti `closeAppPool` terpanggil).
4. Nilai mentah FCM tak pernah muncul di respons API mana pun (assert daftar kunci respons detail).
5. `deleteApp` pada app active/suspended → `BadRequest` (destruktif hanya untuk failed).

## Rulings (keputusan antar-tugas, mengikat)

- R1: Registry dipertahankan `failed` + alasan saat saga gagal (tanpa kompensasi hapus); retry memakai baris yang sama.
- R2: Tanpa mutasi `createApp` terpisah — pembuatan registry melekat pada saga `provisionApp`.
- R3: `ALTER TYPE … ADD VALUE` dieksekusi sebagai statement terpisah (satu `execute()` per statement); `down()` tak menghapus nilai enum (keterbatasan Postgres).
- R4: Advisory lock pada SATU koneksi khusus yang dipegang selama saga; kunci `hashtext('provision:' || slug)` server-side.
- R5: Timeout = `Promise.race` + cek abort tiap step; tak pernah kompensasi dari timer.
- R6: `modules` non-kosong ditolak (`BadRequest`, Fase 2); audit dilewati (F06 retrofit, preseden R5-F05).
- R7: Slug `/^[a-z0-9]([a-z0-9-]{1,62}[a-z0-9])?$/`; `dbName` divalidasi allowlist; `datname` selalu parameter; identifier ter-quote setelah validasi.
- R8: FCM AES-256-GCM (`iv:tag:data` hex); env `FCM_CREDENTIAL_KEY` opsional (64 hex); salah/tak ada → `InternalServerErrorException` jelas saat dipakai.
- R9: Query `apps` default active-only (kompat F05); nilai eksplisit `all` + enam status; CMS registry default `all`.
- R10: Transisi: suspend(active→suspended), unsuspend(suspended→active), archive(active|suspended→archived), delete(failed saja + best-effort DROP); suspend/archive memanggil `closeAppPool`.
- R11: Migrasi template = `.ts` timestamp di `src/database/migration/app-template/` (terkompilasi ke dist agar bisa dimuat in-process); dipakai-ulang via `migrateUp("app-template", db)`. Loader memakai `require()` jalur absolut (hasil kompilasi CJS menolak `import()` URL file://); pola file mengecualikan `.d.ts`.
- R12: Branch `feature/F03-registry-provisioning` dari HEAD F05 (stacked — F03 butuh kode F05); kerja in-place.
- R13: Kegagalan tengah-saga dibuktikan unit (mock) + fixture `failed`; tanpa injeksi crash live. Smoke CMS tanpa asersi konten (client-rendered).
- R14: Timestamp GraphQL memakai `GraphQLISODateTime`.

## File Structure

API (`apps/api/`):
- `src/modules/platform/entities/apps.entity.ts` (Ubah: enum +`provisioning`,`failed`; +`failureReason?`, `+lastProvisioningAt?`)
- `src/modules/platform/entities/app-configs.entity.ts` (Baru: doc 06 penuh)
- `src/modules/shared/entities/users.entity.ts`, `media.entity.ts`, `device-tokens.entity.ts` (Baru: doc 06 §3)
- `migrations/platform/20261116000001_platform_apps_saga.ts` (Baru: ALTER enum terpisah + kolom + app_configs)
- `migrations/app-template/20261116000001_app_template_init.ts` (Baru: users/media/device_tokens + type)
- `src/database/database.service.ts` (Ubah: `withControlPlaneClient`, `databaseExists`, `createDatabase`, `dropDatabaseIfExists`, `withAppDbConnection`, `closeAppPool`) + tambah spec ke `database.service.spec.ts`
- `src/modules/platform/apps/apps.repository.ts` (Ubah: insert/update/delete/list+filter/failed helpers)
- `src/modules/platform/apps/apps.service.ts` (Baru: CRUD + transisi + delete + FCM status)
- `src/modules/platform/apps/app-configs.repository.ts` (Baru: insertDefault/deleteByAppId)
- `src/modules/platform/apps/fcm-credential.service.ts` + spec (Baru: R8)
- `src/modules/platform/apps/provisioning.service.ts` + spec (Baru: saga)
- `src/modules/platform/apps/types/app.type.ts` (Ubah: field penuh), `dto/app.input.ts` (Baru), `apps.resolver.ts` (Ubah: query+mutasi), `apps.module.ts` (Ubah: daftarkan)
- `src/config/env.validation.ts` + spec (Ubah: `FCM_CREDENTIAL_KEY?`, `PROVISION_TIMEOUT_MS`), `apps/api/.env.example` (Ubah: contoh + komentar CREATEDB)

CMS (`apps/cms/`):
- `features/apps/graphql/apps.graphql.ts` (Baru), `app/platform/apps/page.tsx`, `new/page.tsx`, `[slug]/page.tsx` (Baru)

---

### Task 0: Setup — branch, status, baseline, ledger

**Files:**
- Modify: `features/F03-registry-provisioning.md` (Status → Dikerjakan), `features/README.md` (baris F03 → Dikerjakan)

**Interfaces:**
- Produces: branch `feature/F03-registry-provisioning`; ledger `<workspace>/progress.md` baris 1 `# SDD ledger — plan: docs/superpowers/plans/2026-11-16-f03-registry-provisioning.md`

- [ ] **Step 1: Buat branch dari HEAD F05**
Run: `git checkout -b feature/F03-registry-provisioning feature/F05-rbac-dinamis` (R12)
Expected: `Switched to a new branch 'feature/F03-registry-provisioning'`
- [ ] **Step 2: Inisialisasi ledger plan** (manual di `<repo>/.superpowers/sdd/2026-11-16-f03-registry-provisioning/progress.md`; `.superpowers/` sudah diabaikan).
- [ ] **Step 3: Balik status F03 → Dikerjakan** di dua file features.
- [ ] **Step 4: Baseline hijau.** Run: gerbang penuh (Constraints). Expected: exit 0 semua.
- [ ] **Step 5: Commit**
```bash
git add features/F03-registry-provisioning.md features/README.md docs/superpowers/plans/2026-11-16-f03-registry-provisioning.md
git commit -m "chore(f03): mulai registry & provisioning di branch feature/F03-registry-provisioning"
```

### Task 1: Migrasi platform (enum, kolom saga, app_configs)

**Files:**
- Modify: `apps/api/src/modules/platform/entities/apps.entity.ts` (enum +`provisioning`,`failed`; +`failureReason?`, `+lastProvisioningAt?`)
- Create: `apps/api/src/modules/platform/entities/app-configs.entity.ts`, `apps/api/migrations/platform/20261116000001_platform_apps_saga.ts`

**Interfaces:**
- `AppConfigRow { appId: number; maintenanceMode: boolean; maintenanceMessage: string | null; minVersionAndroid: string; minVersionIos: string; themePrimaryColor: string; logoMediaUrl: string | null; supportEmail: string | null; supportWhatsapp: string | null }` (doc 06; tanpa createdAt/updated? doc 06 tak mencantumkan — IKUTI doc 06 apa adanya: tanpa timestamps)

**Entity `app_configs`**: `appId` bigint PK + FK→`apps.id` (satu baris per aplikasi); kolom doc 06; `maintenanceMode` NOT NULL DEFAULT false; versi/tema NOT NULL (default diisi saga).

- [ ] **Step 1: Tulis/ubah entity.**
- [ ] **Step 2: RED — migrasi pending.** Tulis file migrasi M-F03-1 DULU? TIDAK — urutan TDD migrasi: tulis file migrasi (kode), lalu RED=status pending, GREEN=up. File migrasi:
  - `up()`: (1) `ALTER TYPE "public"."app_status" ADD VALUE IF NOT EXISTS 'provisioning'` — execute TERPISAH (R3); (2) idem `'failed'`; (3) `sql.raw` verbatim generate (kolom + `app_configs` + FK + index — hasil generate disaring seperti F05).
  - `down()`: DROP `app_configs`; DROP COLUMN `failure_reason`, `last_provisioning_at`; nilai enum DIBIARKAN (R3 + komentar).
  - Generate: `drizzle-kit generate --config drizzle.config.platform.ts`, saring pernyataan baru, bersihkan artefak (`.sql`/snapshot/journal) konvensi F01.
- [ ] **Step 3: RED.** Run: `bun run db:migrate status --scope platform` (dari `apps/api`). Expected: M-F03-1 `[ ]` Pending.
- [ ] **Step 4: GREEN.** Run: `up` → `Diterapkan (1)`; `down --steps 1` → rollback; `up` → lagi.
- [ ] **Step 5: Commit**
```bash
git add <files Task 1>
git commit -m "feat(api): F03 skema saga + app_configs"
```

### Task 2: Template App DB (entitas + migrasi scope app-template)

**Files:**
- Create: `apps/api/src/modules/shared/entities/users.entity.ts`, `media.entity.ts`, `device-tokens.entity.ts` (doc 06 §3; `device_platform` enum android|ios), `apps/api/migrations/app-template/20261116000001_app_template_init.ts`

**Interfaces:**
- `users`: id, name, email UNIQUE NULL, phone UNIQUE NULL, avatar_url NULL, is_active DEFAULT true, metadata jsonb NULL, last_login_at NULL, timestamps. `media`: id, uploaded_by_admin_id NULL (bigint, TANPA FK — logis lintas DB), file_name/path/url, mime_type/size_bytes, alt_text NULL, timestamps. `device_tokens`: id, user_id FK NULL, token UNIQUE, platform enum, app_version NULL, last_seen_at NOT NULL DEFAULT now(), timestamps.

- [ ] **Step 1: Tulis tiga entity.**
- [ ] **Step 2: Generate + tulis file migrasi** (`drizzle-kit generate --config drizzle.config.app-template.ts`; SQL verbatim; bersihkan artefak; `down()`: DROP device_tokens/media/users + `DROP TYPE device_platform`).
- [ ] **Step 3: RED — roundtrip DB scratch.** Bentuk psql: `docker compose exec -T postgres psql -U postgres -d <db> -c "<sql>"` (dari root). Run: `CREATE DATABASE zz_tmpl_probe` (d `postgres`); `bun run db:migrate status --scope app-template --db zz_tmpl_probe` (dari `apps/api`) → Pending (RED).
- [ ] **Step 4: GREEN.** Run: `up --scope app-template --db zz_tmpl_probe` → `Diterapkan (1)`; `\dt` di `zz_tmpl_probe` memuat users/media/device_tokens/schema_migrations; `down` → hilang; `DROP DATABASE zz_tmpl_probe`.
- [ ] **Step 5: Commit**
```bash
git add <files Task 2>
git commit -m "feat(api): F03 template App DB + migrasinya"
```

### Task 3: Operasi DB admin di DatabaseService

**Files:**
- Modify: `apps/api/src/database/database.service.ts`, `apps/api/src/database/database.service.spec.ts`

**Interfaces:**
- Produces: `withControlPlaneClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>`; `databaseExists(dbName): Promise<boolean>`; `createDatabase(dbName): Promise<void>`; `dropDatabaseIfExists(dbName): Promise<void>` (terminate-backend dulu, kecuali diri sendiri); `withAppDbConnection<T>(dbName, fn: (db: Db) => Promise<T>)`; `closeAppPool(slug): Promise<boolean>`.
- Validasi nama: `/^[a-zA-Z_][a-zA-Z0-9_]*$/` else `BadRequestException("Nama database tidak valid.")`. Pool admin: `${POSTGRES_BASE_URL}/postgres`, max 2, end di finally. `datname` selalu parameter `$1`; identifier ter-quote setelah validasi.

- [ ] **Step 1: Tulis spec gagal** (`jest.mock("pg")`): `createDatabase` mengirim `CREATE DATABASE "app_x"`; `dropDatabaseIfExists` mengirim terminate + DROP; nama jahat (`x"; DROP`) → BadRequest tanpa query; `withControlPlaneClient` me-release koneksi; `closeAppPool` slug tak dikenal → `false` (jalur `true` dibuktikan smoke Task 9 di API nyata).
```typescript
it("menolak nama database di luar allowlist tanpa query", async () => {
  const { service, pools } = makeService();
  await expect(service.createDatabase('x"; DROP TABLE apps; --')).rejects.toThrow(BadRequestException);
  expect(Pool).not.toHaveBeenCalled();
});
```
- [ ] **Step 2: RED.** Run spec database. Expected: FAIL (method tak ada).
- [ ] **Step 3: Implementasi** enam method + pool admin ephemeral.
- [ ] **Step 4: GREEN.** Run spec. Expected: PASS. Boot API OK (DI tak berubah bentuk — tanpa provider baru).
- [ ] **Step 5: Commit**
```bash
git add <files Task 3>
git commit -m "feat(api): F03 operasi DB admin + pinjam koneksi"
```

### Task 4: AppsService — registry, transisi, FCM status

**Files:**
- Create: `apps/api/src/modules/platform/apps/apps.service.ts`, `apps.service.spec.ts`, `apps/api/src/modules/platform/apps/app-configs.repository.ts`, `apps/api/src/modules/platform/apps/fcm-credential.service.ts`, `fcm-credential.service.spec.ts`
- Modify: `apps/api/src/modules/platform/apps/apps.repository.ts` (+insert/update/delete/list), `apps.module.ts` (daftarkan), `apps/api/src/config/env.validation.ts` + spec (+`FCM_CREDENTIAL_KEY?`, `PROVISION_TIMEOUT_MS`), `apps/api/.env.example` (+contoh + komentar CREATEDB)

**Interfaces:**
- Consumes: `DatabaseService` (+Task 3), `AppsRepository`, `AppConfigsRepository`, `FcmCredentialService`.
- Produces: `AppDetail { id, name, slug, iconMediaUrl, status, dbName, androidPackage, iosBundleId, storeUrlAndroid, storeUrlIos, notes, failureReason, lastProvisioningAt: Date | null, createdAt: Date, updatedAt: Date, fcmConfigured: boolean }` (id string; tanggal `Date` — resolver memetakan ke GraphQL).
- `AppsRepository`: `insert(db, CreateAppRow)`, `findById`, `findBySlug`, `list({ status?: AppStatus | "all"; search?: string })`, `updateById(db, id, patch)`, `setStatus(db, id, status)`, `setFailed(db, id, reason)`, `markProvisioning(db, id)` (status+timestamp+clear reason), `deleteById`, `updateFcm(db, id, cipher|null)`.
- `AppsService`: `listApps({ status?; search? })` (default active-only; `"all"` + enam nilai; else BadRequest); `findBySlugDetailed(slug)` / NotFound; `updateApp(id, patch)` (name/notes/icon/store/package; tolak field lain); `suspendApp/unsuspendApp/archiveApp(id)` (R10 + `closeAppPool`); `deleteApp(id)` (failed saja + best-effort DROP + hapus config+row); `setFcmCredential(id, jsonString)` (validasi JSON `{project_id,private_key,client_email}` → BadRequest; encrypt → simpan).
- `FcmCredentialService.encrypt(plaintext): string` / `decrypt(cipher): string` (AES-256-GCM, format `iv:tag:data` hex); kunci hilang/format salah → `InternalServerErrorException("Layanan kredensial FCM belum dikonfigurasi dengan benar.")`.
- `AppConfigsRepository.insertDefault(db, appId)` (maintenance false, versi 1.0.0, tema `#1976D2`) / `deleteByAppId(db, appId)`.
- Env: `FCM_CREDENTIAL_KEY?` (bila ada wajib `/^[0-9a-fA-F]{64}$/`); `PROVISION_TIMEOUT_MS?` (int positif, default 30000).

- [ ] **Step 1: Tulis spec gagal**: transisi ilegal (suspend non-active → BadRequest; unsuspend non-suspended → BadRequest; delete active → BadRequest [RF5]); `setFcmCredential` JSON rusak → BadRequest + repo tak dipanggil; encrypt roundtrip; key hilang → InternalServerError; env: key 63-char ditolak, timeout default 30000.
```typescript
it("deleteApp menolak app active", async () => {
  apps.findById.mockResolvedValue(appRow({ status: "active" }));
  await expect(service.deleteApp("1")).rejects.toThrow(BadRequestException);
  expect(database.dropDatabaseIfExists).not.toHaveBeenCalled();
});
```
- [ ] **Step 2: RED.** Run tiga spec Task 4. Expected: FAIL.
- [ ] **Step 3: Implementasi** repo + service + FCM + env + contoh env.
- [ ] **Step 4: GREEN.** Run tiga spec. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add <files Task 4>
git commit -m "feat(api): F03 registry service + transisi + FCM"
```

### Task 5: ProvisioningService — saga

**Files:**
- Create: `apps/api/src/modules/platform/apps/provisioning.service.ts`, `provisioning.service.spec.ts`
- Modify: `apps/api/src/modules/platform/apps/apps.module.ts` (daftarkan)

**Interfaces:**
- Consumes: `DatabaseService` (Task 3), `AppsRepository` + `AppConfigsRepository` LANGSUNG (satu modul; bukan via `AppsService` — saga butuh operasi level-baris), `migrateUp` (import langsung dari `migration-runner`; spec via `jest.mock`), `ConfigService` (timeout). `AppDetail` import type dari `apps.service`.
- Produces: `provisionApp(input: { name; slug; iconMediaUrl?; androidPackage?; iosBundleId?; storeUrlAndroid?; storeUrlIos?; notes?; modules?: string[] }): Promise<AppDetail>`; `retryProvisionApp(slug): Promise<AppDetail>`.
- Alur provision: lock (`pg_try_advisory_lock(hashtext('provision:'||slug))` di koneksi khusus; gagal → Conflict "sedang berjalan") → race(timeout, saga): validasi (format+unik+modules kosong) → insert registry (provisioning, lastProvisioningAt) → createDatabase → template migrate (`withAppDbConnection` + `migrateUp("app-template")`) → insertDefaultConfig → activate → refetch return. Gagal → kompensasi LIFO (config delete, DROP DB) → setFailed(reason incl. kompensasi-gagal) → rethrow. Unlock+release di finally.
- Alur retry: baris ada? (tak ada → NotFound; bukan failed → BadRequest [RF2]) → lock → dropIfExists + deleteConfig + markProvisioning → runSteps(3–7) → kompensasi sama bila gagal.
- Timeout: cek `signal.aborted` sebelum tiap step → `RequestTimeoutException("Provisioning timeout")`.

- [ ] **Step 1: Tulis spec gagal** (semua dep mock): sukses memanggil step berurutan + return fresh active; migrasi gagal → drop dipanggil + `setFailed` dipanggil + error asli dilempar; kompensasi gagal ikut dicatat di reason; lock gagal → Conflict tanpa side effect; slug format salah → BadRequest; modules non-kosong → BadRequest; retry active → BadRequest [RF2]; timeout 5ms + migrasi menggantung → RequestTimeout + failed.
```typescript
it("migrasi gagal → DROP DB + tandai failed + lempar asli", async () => {
  migrateUp.mockRejectedValue(new Error("migasi rusak"));
  await expect(service.provisionApp({ name: "X", slug: "uji-x" })).rejects.toThrow("migasi rusak");
  expect(database.dropDatabaseIfExists).toHaveBeenCalledWith("app_uji_x");
  expect(apps.setFailed).toHaveBeenCalled();
});
```
- [ ] **Step 2: RED.** Run spec. Expected: FAIL.
- [ ] **Step 3: Implementasi** saga persis Interfaces (cek abort sebelum step 2–7).
- [ ] **Step 4: GREEN.** Run spec. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add <files Task 5>
git commit -m "feat(api): F03 saga provisioning + retry"
```

### Task 6: GraphQL apps — tipe penuh, query, mutasi

**Files:**
- Create: `apps/api/src/modules/platform/apps/dto/app.input.ts`
- Modify: `apps/api/src/modules/platform/apps/types/app.type.ts` (field penuh), `apps.resolver.ts` (query+mutasi), `apps/api/src/modules/platform/rbac/resolver-metadata.spec.ts` (+aturan apps)

**Interfaces** (nama persis doc 07 rekonsiliasi; query `apps.view`, mutasi `apps.manage`):
- `AppType` += `dbName, androidPackage?, iosBundleId?, storeUrlAndroid?, storeUrlIos?, notes?, iconMediaUrl?, status, failureReason?, lastProvisioningAt?: GraphQLISODateTime, createdAt: GraphQLISODateTime, fcmConfigured: Boolean!` (TANPA kredensial mentah — EVER).
- `apps(status?: String, search?: String): [AppType!]!` (default active; `"all"` diizinkan); `app(slug: String!): AppType!`; `updateApp(id, input)/suspendApp(id)/unsuspendApp(id)/archiveApp(id)/deleteApp(id): AppType!/Boolean!`; `retryProvisionApp(slug: String!): AppType!`; `provisionApp(input: ProvisionAppInput!): AppType!`; `setFcmCredential(appId: ID!, serviceAccountJson: String!): Boolean!`.
- SEMUA decorator bertipe eksplisit (R-bun F05).

- [ ] **Step 1: Tambah aturan metadata gagal** (AppsResolver baru: provisionApp/retry/suspend/unsuspend/archive/delete/updateApp/setFcmCredential → `apps.manage`; apps/app → `apps.view`).
- [ ] **Step 2: RED.** Run metadata spec. Expected: FAIL (method tak ada).
- [ ] **Step 3: Implementasi** tipe + input (`ProvisionAppInput` class-validator incl. regex slug; `UpdateAppInput` semua opsional) + resolver (delegasi tipis ke service).
- [ ] **Step 4: GREEN.** Run metadata spec → PASS. Boot API → skema memuat `provisionApp`, `retryProvisionApp`, `setFcmCredential` (grep).
- [ ] **Step 5: Commit**
```bash
git add <files Task 6>
git commit -m "feat(api): F03 GraphQL registry + provisioning"
```

### Task 7: CMS — daftar, tambah+provision, detail, FCM

**Files:**
- Create: `apps/cms/features/apps/graphql/apps.graphql.ts`, `app/platform/apps/page.tsx` (daftar + search + filter status incl. "Semua"), `app/platform/apps/new/page.tsx` (form → provisionApp + spinner + galat), `app/platform/apps/[slug]/page.tsx` (info + aksi status kondisional + kartu FCM + danger delete-failed)

**Interfaces:**
- Dokumen handwritten (R10-F05): `APPS_QUERY(status, search)`, `APP_QUERY(slug)`, `PROVISION_APP_MUTATION`, `RETRY_MUTATION`, `UPDATE_APP_MUTATION`, `SUSPEND/UNSUSPEND/ARCHIVE/DELETE_MUTATION`, `SET_FCM_MUTATION`.
- Daftar: tabel nama/slug/status/tanggal + aksi Kelola; filter status default `"all"`.
- New: name/slug/metadata opsional → `provisionApp`; pending spinner + pesan; sukses → push detail; gagal → pesan + tautan ke detail (baris failed).
- Detail: info paket/store, status FCM (Terpasang/Belum), tombol aksi sesuai status (failed: Retry+Hapus; active: Suspend; suspended: Aktifkan+Arsip; archived: —), form FCM (textarea paste + simpan; setelah tersimpan tampil bertopeng + tombol Ganti), form update info dasar.
- Semua aksi destruktif pakai `window.confirm`; galat via `graphQLErrorMessage` (reuse helper F05); tombol termanage di `PermissionGate apps.manage`.

- [ ] **Step 1: Tulis dokumen GraphQL.**
- [ ] **Step 2: RED — rute belum ada.** Run: `bun --filter cms build` → exit 0 TETAPI tabel rute TIDAK memuat `/platform/apps`.
- [ ] **Step 3: Tulis 3 halaman** (gaya F01/F05: `"use client"`, slate, pesan Indonesia; tanpa identitas visual baru).
- [ ] **Step 4: GREEN.** Run: cms typecheck + lint + build → exit 0 + rute `/platform/apps` tercantum.
- [ ] **Step 5: Commit**
```bash
git add <files Task 7>
git commit -m "feat(cms): F03 halaman registry + provisioning + FCM"
```

### Task 8: Docs + gerbang penuh + smoke F03

**Files:**
- Modify: `features/F03-registry-provisioning.md` (semua `- [x]`, Status Selesai), `features/README.md` (F03 Selesai)

**Interfaces:** (verifikasi akhir; tanpa kode baru kecuali perbaikan temuan smoke)
- Prasyarat: `docker compose up -d`, migrasi platform terkini, `seed:admin` super.

- [ ] **Step 1: Smoke provision sukses.** `provisionApp(slug: uji-<ts>)` → status active; verifikasi via psql: DB `app_uji_<ts>` ada + tabel `users,media,device_tokens,schema_migrations` ada + baris `app_configs` ada (kriteria 1).
- [ ] **Step 2: Smoke validasi + konflik.** Slug format salah → `BAD_USER_INPUT`; slug duplikat → `ConflictException` ("sudah terdaftar"); `modules: ["cbt"]` → `BadRequest` Fase 2; dua provision bersamaan slug sama (2 job paralel) → tepat satu sukses, satunya `Conflict` ("sedang berjalan" ATAU "sudah terdaftar" — keduanya sah; jalur lock dipin deterministik di unit Task 5) [RF1].
- [ ] **Step 3: Smoke failed + retry + transisi.** Sisipkan fixture `failed` via psql (alasan uji); `retryProvisionApp` → active + DB terbentuk; `suspendApp` → suspended + `getAppConnection` melempar walau pool hangat (probe bun, [RF3]); `unsuspendApp` → active; `archiveApp` → archived; `retryProvisionApp` pada active → BadRequest [RF2]; `deleteApp` pada active → BadRequest [RF5]; `deleteApp` pada failed → hilang + tak ada DB yatim (psql).
- [ ] **Step 4: Smoke FCM + CMS.** `setFcmCredential` JSON valid → `fcmConfigured: true`; query `app` tak memuat kredensial mentah [RF4]; nilai kolom DB ≠ plaintext (psql, terenkripsi); JSON rusak → BadRequest. CMS: `/platform/apps` tanpa sesi → redirect `/login`; dengan sesi → 200; `/platform/apps/new`, `/platform/apps/<slug>` → 200.
- [ ] **Step 5: Gerbang penuh + sinkron docs.** Run gerbang (Constraints) → exit 0 semua. Balik status/docs (§Files). Commit docs:
```bash
git add features/
git commit -m "docs: tandai F03 selesai"
```
Skrip smoke disimpan di `.tmp/smoke-f03-api.ps1` (abaikan git, dapat dijalankan ulang).
