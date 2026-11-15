# F05 RBAC Dinamis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Role dan permission dinamis yang dirangkai dari CMS dan ditegakkan server: katalog permission di-seed saat boot, guard menolak operasi tanpa hak (`FORBIDDEN` + `requiredPermission`), perubahan berlaku segera.

**Architecture:** Tabel RBAC + registry `apps` minimal di control-plane; `RbacService` mengevaluasi izin (exact/`manage`/`*` per segmen) dengan cache Redis version-stamp; `PermissionGuard` + `@RequirePermissions` mengunci resolver global; CMS mengelola role/admin dengan komponen `PermissionGate`.

**Tech Stack:** NestJS 11 + GraphQL code-first, Drizzle ORM + drizzle-kit, PostgreSQL 16, Redis (ioredis), Next.js 16 + Apollo Client v4, Jest + ts-jest.

**Spec:** `features/F05-rbac-dinamis.md` (+ `docs/04-user-role-permission.md`, `docs/06-database-design.md`, `docs/07-api-design.md` §1–2, `pattern/backend-pattern.md` §2–3)

## Global Constraints

- TypeScript `strict: true`, tanpa `any`; import tipe via `import type`; return type eksplisit di service & repository.
- ID GraphQL string (`ID` scalar); kolom DB `bigint`; tulis `String(row.id)`, baca via parse + validasi (`NaN` → `BAD_USER_INPUT`).
- Waktu ISO-8601 UTC; DB `snake_case`; file `kebab-case`; pesan error Bahasa Indonesia.
- Alur Resolver → Service → Repository; repository stateless, argumen pertama `Db`; tanpa query Drizzle di service/resolver.
- Pagination: `PaginationArgs` (`skip`/`take`, `take` ≤ 50) + `{ items, totalCount }`.
- Exception NestJS saja (filter global memetakan `extensions.code`); validasi domain → `BadRequestException`; gagal otorisasi → `ForbiddenException`; konflik data → `ConflictException`.
- Semua perintah `bun` di PowerShell sandbox diawali blok ini (cwd = root repo kecuali dinyatakan lain):
  ```powershell
  $wk = 'C:\Users\F-PC\Desktop\Project\manajemen-aplikasi-mobile'; $env:TEMP = "$wk\.tmp"; $env:TMP = "$wk\.tmp"; $env:TMPDIR = "$wk\.tmp"; $env:BUN_INSTALL_CACHE_DIR = "$wk\.bun-cache"
  ```
- Tes API: `bun run test -- <spec>` dari `apps/api`. Gerbang penuh: `bun run typecheck && bun run lint && bun run test && bun run build` dari root. Setiap perintah gerbang WAJIB memakai guard `if ($LASTEXITCODE -ne 0) { throw ... }` — output stderr PowerShell menyesatkan (exit 1 kosmetik vs gagal asli hanya bisa dibedakan via guard + isi output).
- Tidak ada kerja di branch main/master; push oleh manusia.

## Review Focus

1. `assignRole` dengan `appId` untuk role global (atau tanpa `appId` untuk role app) → ditolak `BAD_USER_INPUT`, bukan tersimpan setengah. [Task 5]
2. `deleteRole` saat penetapan masih ada → ditolak `ConflictException` ("masih dipakai N penetapan"), bukan error FK mentah. [Task 4]
3. `setAdminActive(false)` ke diri sendiri (bukan super-terakhir) → diizinkan; request berikutnya `UNAUTHENTICATED` karena sesi dicabut. [Task 7 + smoke Task 10]
4. Dua `assignRole` identik bersamaan → satu menang, satunya `ConflictException`, bukan 500. [Task 5]
5. `hasPermission(admin, key, appIdSuspended)` tetap `true` bila hak ada — status app BUKAN urusan F05; `AppContextGuard` (F02) yang menolak suspended. [Task 5, boundary test]

## Rulings (keputusan antar-tugas, mengikat)

- R1: F05 membuat tabel `apps` FULL kolom doc 06 (§`apps`) + `AppsRepository` baca-saja + `AppsModule` minimal (export repo saja). F03 memiliki semua perilaku (CRUD/provisioning/FCM/UI). Alasan: F05 butuh app nyata untuk role/assignment cakupan-app; satu CREATE menghindari ALTER churn.
- R2: `admin_role_assignments` memakai PK surrogate `id` + dua partial unique index (`(admin_id,role_id)` saat `app_id` NULL; `(admin_id,role_id,app_id)` saat NOT NULL). Alasan: composite PK dengan kolom NULL tidak valid di Postgres (doc 06 tidak bisa diimplementasi harfiah).
- R3: Pola `*` per segmen dikembangkan menjadi kunci konkret saat validasi role (`resolveKeys`; tak cocok katalog → `BadRequest`); evaluasi memakai exact match + ekspansi `manage` saja. Shorthand 2-segmen (`*.view`) selalu ditolak (tak cocok katalog 3-segmen). Alasan: `role_permissions` menyimpan FK konkret; hak tersimpan eksplisit (tak membesar diam-diam saat katalog bertambah).
- R4: Cache = version-stamp via `RedisService` langsung (`rbac:ver:{adminId}`, `rbac:eff:{adminId}:{appId|global}:{ver}`, TTL 60 dtk); invalidasi sinkron di path mutasi. Alasan: `CacheService`/event-bus belum ada (doc 14 belum dibangun).
- R5: Mutasi F05 TIDAK memanggil audit (AuditLogService lahir di F06; F06 me-retrofit).
- R6: `createAdmin` selalu non-super (super hanya via seed; tanpa mutasi promosi). Tanpa `deleteAdmin` (nonaktifkan saja, doc 04). `updateRole` tidak bisa ubah scope/app (immutable). `deleteRole` menolak bila penetapan ada. Assign ke admin nonaktif diizinkan (akses tetap ditolak via `isActive`).
- R7: F05 menambah query `effectivePermissions(adminId, appId)` + `currentAdmin` (dibutuhkan view CMS F05; dipakai ulang F02). doc 07 §2 ditambah dua baris di Task 10.
- R8: Tes resolver = unit guard + smoke GraphQL (preseden F01), bukan modul testing Nest per resolver.
- R9: Branch `feature/F05-rbac-dinamis` dari HEAD `feature/F01-auth-admin`, kerja in-place (konvensi proyek; worktree menyulitkan alur push-manual + docker dev).
- R10: Dokumen GraphQL CMS handwritten (tanpa codegen — belum dikonfigurasi). Link `X-App-Slug` tetap F02 (NOTE apollo-client tidak disentuh).
- R11: `RbacService` tidak membaca tabel `admins` (hindari siklus modul): guard meneruskan profil terverifikasi (`{ id, isSuperAdmin }`); `listEffectivePermissions` mengembalikan kunci turunan-assignment saja; bypass super urusan pemanggil.
- R12: Nama role unik dalam konteks cakupannya (partial unique index, cakupan global vs per-app); pelanggaran → `ConflictException`.

## File Structure

API (`apps/api/src/`):
- `modules/platform/entities/apps.entity.ts` — tabel `apps` + enum `app_status` (R1)
- `modules/platform/entities/roles.entity.ts` — tabel `roles` + enum `role_scope`
- `modules/platform/entities/permissions.entity.ts` — tabel `permissions`
- `modules/platform/entities/role-assignments.entity.ts` — `role_permissions`, `admin_role_assignments` (R2)
- `modules/platform/apps/apps.repository.ts` + `apps.module.ts` — baca-saja (R1)
- `modules/platform/rbac/rbac.module.ts` — daftarkan semua provider di bawah; `onModuleInit` seed katalog
- `modules/platform/rbac/platform.permissions.ts` — `PLATFORM_CATALOG: PermissionDef[]` (18 kunci, §katalog)
- `modules/platform/rbac/permissions.repository.ts` + `permissions.service.ts` — `syncCatalog()`, `listByModule()`
- `modules/platform/rbac/roles.repository.ts` + `roles.service.ts` — CRUD + validasi R6/R12
- `modules/platform/rbac/assignments.repository.ts` + `assignments.service.ts` — assign/unassign + validasi
- `modules/platform/rbac/rbac.service.ts` — `hasPermission`, `listEffectivePermissions`, cache R4, matcher R3
- `modules/platform/rbac/roles.resolver.ts` — `roles`, `permissions`, `createRole/updateRole/deleteRole`, `assignRole/unassignRole`
- `modules/platform/admins/admins.repository.ts` (tambah) + `admins.service.ts` (tambah) + `admins.resolver.ts` (baru) + `admins.module.ts` (import `RbacModule`)
- `common/guards/permission.guard.ts` + `common/decorators/require-permissions.decorator.ts`
- `migrations/platform/20261115000001_platform_rbac_apps.ts` + `20261115000002_platform_rbac_tables.ts`
- `scripts/seed-demo-apps.ts` + entri skrip `seed:demo-apps` di `apps/api/package.json`
- Spec colocated `*.spec.ts` per tugas; tipe GraphQL di `modules/platform/rbac/types/*.type.ts`, input di `dto/*.input.ts`

CMS (`apps/cms/`):
- `features/rbac/graphql/*.ts` — dokumen query/mutasi handwritten (R10)
- `features/rbac/components/permission-gate.tsx` + `features/rbac/hooks/use-effective-permissions.ts`
- `app/platform/roles/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
- `app/platform/admins/page.tsx`, `new/page.tsx`, `[id]/page.tsx`

### Katalog `platform.*` (16 kunci, label Indonesia)

globalOnly — `platform.apps.view` (Melihat daftar aplikasi), `platform.apps.manage` (Mengelola aplikasi), `platform.roles.view`, `platform.roles.manage`, `platform.admins.view`, `platform.admins.manage`.
Dua cakupan — `platform.users.view/manage`, `platform.media.view/create/delete`, `platform.notifications.view/send`, `platform.app-config.view/manage`, `platform.audit.view`.

---

### Task 0: Setup — branch, status, baseline, ledger

**Files:**
- Modify: `features/F05-rbac-dinamis.md` (Status → Dikerjakan), `features/README.md` (baris F05 → Dikerjakan)

**Interfaces:**
- Produces: branch `feature/F05-rbac-dinamis`; ledger `<workspace>/progress.md` baris 1 `# SDD ledger — plan: docs/superpowers/plans/2026-11-15-f05-rbac-dinamis.md`

- [ ] **Step 1: Buat branch dari HEAD F01**
Run: `git checkout -b feature/F05-rbac-dinamis feature/F01-auth-admin` (R9)
Expected: `Switched to a new branch 'feature/F05-rbac-dinamis'`
- [ ] **Step 2: Inisialisasi ledger plan**
Run: skrip `sdd-workspace` (bash) bila tersedia; bila gagal (Windows tanpa bash) buat manual `<repo>/.superpowers/sdd/2026-11-15-f05-rbac-dinamis/progress.md` dengan baris identitas di atas. Pastikan `.superpowers/` diabaikan git (`git check-ignore -q .superpowers` atau tambah ke `.gitignore`).
Expected: file ledger ada; `git status --short` tidak menampilkan `.superpowers/`
- [ ] **Step 3: Balik status F05 → Dikerjakan** di dua file features.
- [ ] **Step 4: Baseline hijau**
Run: gerbang penuh (Constraints). Expected: exit 0 semua.
- [ ] **Step 5: Commit**
```bash
git add features/F05-rbac-dinamis.md features/README.md .gitignore
git commit -m "chore(f05): mulai RBAC dinamis di branch feature/F05-rbac-dinamis"
```

### Task 1: Tabel `apps` + repo baca + migrasi M1 + seed demo

**Files:**
- Create: `apps/api/src/modules/platform/entities/apps.entity.ts`, `apps/api/src/modules/platform/apps/apps.repository.ts`, `apps/api/src/modules/platform/apps/apps.module.ts`, `apps/api/migrations/platform/20261115000001_platform_rbac_apps.ts`, `apps/api/src/scripts/seed-demo-apps.ts`
- Modify: `apps/api/package.json` (skrip `seed:demo-apps`), `apps/api/src/app.module.ts` (import `AppsModule`)

**Interfaces:**
- Produces: `AppsRepository.findById(db, id: number): Promise<AppRow | null>`, `findBySlug(db, slug: string)`, `listActive(db): Promise<AppRow[]>`; skrip `bun run seed:demo-apps` (dari `apps/api`) menyisipkan `tes-cpns` + `ngewarung` (`active`) bila slug belum ada, mencetak jumlah disisipkan.

**Entity `apps`** (doc 06 penuh, R1): `id` bigint identity PK; `name`, `slug` UNIQUE, `iconMediaUrl?`, `status` enum `app_status(active,suspended,archived)` NOT NULL DEFAULT `active`, `dbName`, `androidPackage?`, `iosBundleId?`, `storeUrlAndroid?`, `storeUrlIos?`, `fcmCredential?` (text), `notes?`, `createdAt/updatedAt` (pola `admins.entity.ts`).

- [ ] **Step 1: Tulis entity + repository + module + skrip seed** (ikuti pola admins; tanpa service/resolver).
- [ ] **Step 2: Generate + tulis file migrasi M1.** Run `drizzle-kit generate --config drizzle.config.platform.ts` (dari `apps/api`); pindahkan SQL hasil ke `UP_SQL` verbatim pola 0001; tulis `down()` (`DROP TABLE IF EXISTS "apps"`).
- [ ] **Step 3: RED — status pending.** Run: `bun run db:migrate status --scope platform` (dari `apps/api`). Expected: M1 tercantum `[ ]` Pending.
- [ ] **Step 4: GREEN — up.** Run: `bun run db:migrate up --scope platform`. Expected: `Diterapkan (1): + 20261115000001_platform_rbac_apps.ts`.
- [ ] **Step 5: Down-up roundtrip + seed.** Run: `down --scope platform --steps 1` → `Di-rollback (1)`; `up` lagi → `Diterapkan (1)`; `seed:demo-apps` → mencetak `disisipkan: 2`; ulangi → `disisipkan: 0` (idempoten).
- [ ] **Step 6: Commit**
```bash
git add <files Task 1>
git commit -m "feat(api): F05 tabel apps + repo baca + seed demo"
```

### Task 2: Entitas RBAC + migrasi M2

**Files:**
- Create: `apps/api/src/modules/platform/entities/roles.entity.ts`, `permissions.entity.ts`, `role-assignments.entity.ts`, `apps/api/migrations/platform/20261115000002_platform_rbac_tables.ts`

**Interfaces:** (struktur DB; dikonsumsi Task 3–5)
- `roles`: `id`, `name`, `description?`, `scopeType` enum `role_scope(global,app)` NOT NULL, `appId?` FK→`apps.id`, timestamps; partial unique: `(name)` saat scope global, `(name,app_id)` saat scope app (R12).
- `permissions`: `id`, `key` UNIQUE, `module`, `label`, `description?`, timestamps.
- `role_permissions`: PK `(role_id,permission_id)`, FK keduanya, timestamps.
- `admin_role_assignments`: PK surrogate `id`, `adminId` FK→`admins.id`, `roleId` FK→`roles.id`, `appId?` FK→`apps.id`, timestamps + dua partial unique index (R2).

- [ ] **Step 1: Tulis tiga entity** (pola `admins.entity.ts`; FK via kolom + constraint drizzle).
- [ ] **Step 2: Generate + tulis file migrasi M2** (pola Task 1 Step 3); `down()`: DROP `admin_role_assignments`, `role_permissions`, `permissions`, `roles` (urutan ini).
- [ ] **Step 3: RED — status pending M2.** Run status. Expected: M2 `[ ]` Pending (M1 `[x]`).
- [ ] **Step 4: GREEN — up/down/up.** Run: `up` → `Diterapkan (1)` M2; `down --steps 1` → rollback M2 saja (M1 tetap); `up` → M2 lagi.
- [ ] **Step 5: Commit**
```bash
git add <files Task 2>
git commit -m "feat(api): F05 entitas + tabel RBAC"
```

### Task 3: Katalog permission + seed saat boot

**Files:**
- Create: `apps/api/src/modules/platform/rbac/platform.permissions.ts`, `apps/api/src/modules/platform/rbac/permissions.repository.ts`, `apps/api/src/modules/platform/rbac/permissions.service.ts`, `apps/api/src/modules/platform/rbac/rbac.module.ts`, `apps/api/src/modules/platform/rbac/permissions.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (import `RbacModule`)

**Interfaces:**
- Consumes: `Db` (DatabaseService), tabel `permissions` (Task 2).
- Produces: `PermissionDef { key, module, label, description?, globalOnly }`; `PLATFORM_CATALOG: PermissionDef[]` (16 kunci, §katalog); `isSensitivePermission(key): boolean` (aturan prefix `platform.{apps,roles,admins}.`); `PermissionsService.syncCatalog(defs): Promise<{ inserted: number; updated: number }>`; `listByModule(module?: string): Promise<PermissionRow[]>`; `RbacModule.onModuleInit` → `syncCatalog(PLATFORM_CATALOG)` (idempoten).

- [ ] **Step 1: Tulis spec gagal** `permissions.service.spec.ts`: repo mock; `syncCatalog` dengan 1 key baru + 1 key berubah-label + 1 key sama → ekspektasi `{ inserted: 1, updated: 1 }`; `listByModule("platform")` meneruskan filter.
```typescript
it("menyisipkan yang hilang, memperbarui label berubah, melewati yang sama", async () => {
  // repo.findByKey mock: "a.b" → null; "c.d" → row label lama; "e.f" → row identik
  const result = await service.syncCatalog([...3 defs...]);
  expect(result).toEqual({ inserted: 1, updated: 1 });
});
```
- [ ] **Step 2: RED.** Run: `bun run test -- src/modules/platform/rbac/permissions.service.spec.ts` (dari `apps/api`). Expected: FAIL (modul belum ada).
- [ ] **Step 3: Implementasi** katalog 18 kunci + repository (`findByKey`, `insertMany`, `updateByKey`, `listByModule`) + service + `RbacModule` (`onModuleInit` seed; andalkan koneksi lazy DatabaseService — aman pra-init, pelajaran F01) + daftarkan di `app.module.ts`.
- [ ] **Step 4: GREEN.** Run spec Task 3. Expected: PASS. Run `bun run dev` (API) → boot tanpa error; hentikan.
- [ ] **Step 5: Commit**
```bash
git add <files Task 3>
git commit -m "feat(api): F05 katalog permission + seed saat boot"
```

### Task 4: RolesService — CRUD + validasi cakupan

**Files:**
- Create: `apps/api/src/modules/platform/rbac/roles.repository.ts`, `apps/api/src/modules/platform/rbac/roles.service.ts`, `apps/api/src/modules/platform/rbac/roles.service.spec.ts`, `apps/api/src/modules/platform/rbac/assignments.repository.ts`
- Modify: `apps/api/src/modules/platform/rbac/rbac.module.ts` (daftarkan provider)

**Interfaces:**
- Consumes: `AppsRepository` (cek app ada+aktif), `PermissionsRepository` (resolusi kunci).
- Produces (dipakai Task 5): `AssignmentsRepository.insert(db, { adminId, roleId, appId }): Promise<void>`, `delete(db, {...}): Promise<boolean>`, `exists(db, {...}): Promise<boolean>`, `listAdminIdsByRole(db, roleId): Promise<number[]>`, `listByAdmin(db, adminId): Promise<AssignmentRow[]>` (row: `roleId`, `appId|null`, `scopeType`, `roleAppId|null` via join roles); `RolesRepository.findRolePermissionKeys(db, roleId): Promise<string[]>`.
- Produces: `RolesService.create({ name, description?, scopeType: "global"|"app", appId?, permissionKeys: string[] }): Promise<RoleDetail>`; `update(id, { name?, description?, permissionKeys? })`; `remove(id): Promise<void>`; `findById(id): Promise<RoleDetail>`; `list(scope?, appId?): Promise<RoleDetail[]>`; `RoleDetail { id, name, description, scopeType, appId, permissionKeys }` (id string).
- Validasi: scope `app` wajib `appId` + app ada & aktif; scope `global` tolak `appId`; kunci sensitif `platform.{apps,roles,admins}.*` pada role app → `BadRequestException`; kunci tak dikenal → `BadRequestException`; nama duplikat dalam konteks → `ConflictException`; hapus dengan penetapan → `ConflictException` ("masih dipakai N penetapan").

- [ ] **Step 1: Tulis spec gagal** (repo mocked): buat role app valid; tolak app-role tanpa appId; tolak sensitive-perm pada role app; tolak hapus dengan 2 penetapan (pesan "masih dipakai 2 penetapan").
```typescript
it("menolak permission sensitif pada role cakupan-app", async () => {
  await expect(service.create({ name: "X", scopeType: "app", appId: "1", permissionKeys: ["platform.roles.manage"] }))
    .rejects.toThrow(BadRequestException);
});
```
- [ ] **Step 2: RED.** Run spec Task 4. Expected: FAIL.
- [ ] **Step 3: Implementasi** `RolesRepository` (CRUD + `findRolePermissionKeys`) + `AssignmentsRepository` (persistence sesuai Interfaces; tanpa spec — diuji lewat Task 5 + smoke) + `RolesService` (aturan di atas; `appId` global selalu null).
- [ ] **Step 4: GREEN.** Run spec Task 4. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add <files Task 4>
git commit -m "feat(api): F05 CRUD role + validasi cakupan"
```

### Task 5: Assignment + evaluasi izin + cache

**Files:**
- Create: `apps/api/src/modules/platform/rbac/assignments.service.ts`, `apps/api/src/modules/platform/rbac/rbac.service.ts`, `apps/api/src/modules/platform/rbac/assignments.service.spec.ts`, `apps/api/src/modules/platform/rbac/rbac.service.spec.ts`
- Modify: `apps/api/src/modules/platform/rbac/rbac.module.ts` (daftarkan provider), `apps/api/src/modules/platform/rbac/roles.service.ts` (sambungkan `bumpAdminVersion` ke create/update/remove — affected admins via `listAdminIdsByRole`)

**Interfaces:**
- Consumes: `RolesService.findById`, `AssignmentsRepository` (Task 4), `PermissionsRepository.listByModule`, `RedisService.getClient()` (`get/setex/incr/expire`).
- Produces: `AssignmentsService.assign({ adminId, roleId, appId? }): Promise<void>`; `unassign({ adminId, roleId, appId? })`; `RbacService.hasPermission(profile: { id: string; isSuperAdmin: boolean }, key: string, appId?: string): Promise<boolean>`; `listEffectivePermissions(adminId: string, appId?: string): Promise<string[]>` (terurut, hasil ekspansi; R11); `bumpAdminVersion(adminIds: string[]): Promise<void>`.
- Aturan assign: role app ⇒ `appId` wajib = `role.appId`; role global ⇒ `appId` null; duplikat ⇒ `ConflictException`.
- Matcher (R3): `listEffectivePermissions` = union held-keys + ekspansi `held == {module}.{entity}.manage` ke semua kunci katalog `{module}.{entity}.*`; `hasPermission` = includes(required). Pola `*` tak pernah tersimpan (dikembangkan di `resolveKeys` Task 4).
- Cache (R4): baca `rbac:ver:{adminId}` (default 0) → `rbac:eff:{adminId}:{appId|global}:{ver}` (JSON array, TTL 60); mutasi role/assignment memanggil `bumpAdminVersion(adminIds)` (`INCR` + `EXPIRE`).

- [ ] **Step 1: Tulis spec gagal**: (a) assign: tolak appId-vs-global mismatch [Review Focus 1]; duplikat → Conflict [RF 4]; (b) matcher: `platform.users.manage` mengizinkan `platform.users.view`; `platform.media.*` mengizinkan `platform.media.create`; `platform.media.*` TIDAK mengizinkan `platform.users.view`; `*.view` 2-segmen TIDAK mengizinkan `platform.users.view`; (c) cakupan: role global berlaku dengan `appId` konteks; role app-A tidak berlaku untuk `appId` B; (d) super-admin selalu true; (e) app suspended TETAP true (batas F02) [RF 5]; (f) cache: panggilan kedua tanpa hit repo; setelah bump, repo dipanggil lagi.
```typescript
it("manage mencakup aksi se-entitas; bintang hanya per segmen", async () => {
  await expect(has("platform.users.manage", "platform.users.view")).resolves.toBe(true);
  await expect(has("platform.media.*", "platform.users.view")).resolves.toBe(false);
});
```
- [ ] **Step 2: RED.** Run dua spec Task 5. Expected: FAIL.
- [ ] **Step 3: Implementasi** dua service + `bumpAdminVersion` publik + sambungkan bump ke `RolesService.create/update/remove` (affected via `listAdminIdsByRole`) dan `assign/unassign` (admin ybs). Task 7 menulis pemanggilan bump-nya sendiri di `setActive`.
- [ ] **Step 4: GREEN.** Run dua spec. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add <files Task 5>
git commit -m "feat(api): F05 assignment + evaluasi izin + cache"
```

### Task 6: PermissionGuard + decorator + sebar `requiredPermission`

**Files:**
- Create: `apps/api/src/common/decorators/require-permissions.decorator.ts`, `apps/api/src/common/guards/permission.guard.ts`, `apps/api/src/common/guards/permission.guard.spec.ts`, `apps/api/src/common/filters/graphql-exception.filter.spec.ts`
- Modify: `apps/api/src/modules/platform/rbac/rbac.module.ts` (sediakan + export `PermissionGuard`)

**Interfaces:**
- Produces: `RequirePermissions(...perms: string[])` (metadata key `permissions`, pola `pattern/backend-pattern.md` §3); `PermissionGuard implements CanActivate` — tanpa metadata → `true`; profil dari `req[ADMIN_KEY]` (ditulis `AuthGuard`); super → `true`; selainnya `rbac.hasPermission(profile, key)` untuk tiap key (AND); gagal → `ForbiddenException({ message: "Anda tidak memiliki akses untuk tindakan ini.", requiredPermission: <key-pertama-gagal> })`, tanpa profil → `UnauthorizedException` (pertahanan lapis; `AuthGuard` selalu dulu).

- [ ] **Step 1: Tulis spec gagal**: guard tanpa metadata → true; super → true (service tak dipanggil); kurang izin → `ForbiddenException` dengan `getResponse().requiredPermission == "platform.roles.manage"`; filter spec: exception itu → `GraphQLError` `extensions == { code: "FORBIDDEN", requiredPermission: "platform.roles.manage" }`.
```typescript
it("menolak tanpa izin + membawa requiredPermission", async () => {
  rbac.hasPermission.mockResolvedValue(false);
  await expect(guard.canActivate(ctxWithAdmin({ isSuperAdmin: false }))).rejects.toThrow(ForbiddenException);
  try { await guard.canActivate(ctxWithAdmin({ isSuperAdmin: false })); } catch (e) {
    expect((e as ForbiddenException).getResponse()).toMatchObject({ requiredPermission: "platform.roles.manage" });
  }
});
```
- [ ] **Step 2: RED.** Run dua spec Task 6. Expected: FAIL.
- [ ] **Step 3: Implementasi** decorator + guard + export module. Filter TIDAK diubah (sebar `rest` sudah ada — spec justru menguncinya).
- [ ] **Step 4: GREEN.** Run dua spec. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add <files Task 6>
git commit -m "feat(api): F05 PermissionGuard + decorator + sebar requiredPermission"
```

### Task 7: CRUD admin + proteksi super-terakhir + cabut sesi

**Files:**
- Modify: `apps/api/src/modules/platform/admins/admins.repository.ts`, `apps/api/src/modules/platform/admins/admins.service.ts`
- Create: `apps/api/src/modules/platform/admins/admins.service.spec.ts`

**Interfaces:**
- Consumes: `AuthService.revokeSessions(authUserId)` (@Global, mock di spec), `RbacService.bumpAdminVersion` (pada `setActive`).
- Produces (tambahan): `AdminsRepository.findById(db, id)`, `list(db, { search?, skip, take }): Promise<{ rows; total }>`, `updateName(db, id, name)`, `setActive(db, id, active)`, `countActiveSuperAdmins(db): Promise<number>`; `AdminsService.listAdmins({ search?, skip, take }): Promise<{ items: AdminListItem[]; totalCount: number }>` (`AdminListItem = AdminProfile & { isActive: boolean }`); `updateAdmin(id, { name }): Promise<AdminProfile>`; `setAdminActive(id, active): Promise<AdminListItem>` — nonaktif super-terakhir-aktif → `ForbiddenException("Tidak dapat menonaktifkan Super Admin aktif terakhir.")`; sukses nonaktif → `revokeSessions` + bump versi.
- ID argumen string GraphQL → parse `Number()`; `NaN`/≤0 → `BadRequestException`. Baris tak ada → `NotFoundException("Admin tidak ditemukan.")`.

- [ ] **Step 1: Tulis spec gagal** (repo + auth + rbac mocked): list meneruskan search/skip/take; setActive(false) pada super-terakhir → Forbidden + revoke TAK dipanggil; setActive(false) biasa → revoke + bump dipanggil [Review Focus 3 sebagian — revoke+bump di unit; perilaku request-berikutnya di smoke Task 10].
```typescript
it("menolak menonaktifkan Super Admin aktif terakhir", async () => {
  repo.findById.mockResolvedValue(superRow); repo.countActiveSuperAdmins.mockResolvedValue(1);
  await expect(service.setAdminActive("9", false)).rejects.toThrow("Super Admin aktif terakhir");
  expect(auth.revokeSessions).not.toHaveBeenCalled();
});
```
- [ ] **Step 2: RED.** Run spec Task 7. Expected: FAIL.
- [ ] **Step 3: Implementasi** repo + service sesuai Interfaces.
- [ ] **Step 4: GREEN.** Run spec. Expected: PASS.
- [ ] **Step 5: Commit**
```bash
git add <files Task 7>
git commit -m "feat(api): F05 CRUD admin + proteksi super-terakhir"
```

### Task 8: GraphQL — tipe, resolver, wiring modul

**Files:**
- Create: `apps/api/src/modules/platform/rbac/types/role.type.ts`, `permission.type.ts`, `assignment.type.ts`, `apps/api/src/modules/platform/rbac/dto/role.input.ts`, `assignment.input.ts`, `apps/api/src/modules/platform/rbac/roles.resolver.ts`, `apps/api/src/modules/platform/admins/types/admin.type.ts`, `apps/api/src/modules/platform/admins/dto/admin.input.ts`, `apps/api/src/modules/platform/admins/admins.resolver.ts`, `apps/api/src/modules/platform/rbac/resolver-metadata.spec.ts`
- Modify: `apps/api/src/modules/platform/admins/admins.module.ts` (import `RbacModule`), `apps/api/src/app.module.ts` (tambah `AdminsModule` — FAKTA: root F01 tidak mengimpornya, hanya transitif via `AuthModule`; resolver butuh registrasi root)

**Interfaces** (nama persis doc 07 §2 + R7; semua `@UseGuards(AuthGuard, PermissionGuard)` kecuali `currentAdmin` yang hanya `AuthGuard`):
- `roles(scope: String, appId: ID): [Role!]!`, `permissions(module: String): [Permission!]!`, `createRole(input): Role!` / `updateRole(id, input)` / `deleteRole(id): Boolean!` — `@RequirePermissions("platform.roles.manage")` (read: `platform.roles.view`)
- `assignRole(adminId, roleId, appId): Boolean!` / `unassignRole(...)` — `platform.roles.manage`
- `admins(search, skip, take): AdminConnection!` / `admin(id): Admin` — `platform.admins.view`; `createAdmin(input { name, email, password })` / `updateAdmin(id, input { name })` / `setAdminActive(id, active)` — `platform.admins.manage` (create mendelegasikan identitas ke `AuthService.createAdminAccount` + `isSuperAdmin: false`)
- `currentAdmin: Admin!` (AuthGuard saja), `effectivePermissions(adminId: ID!, appId: ID): [String!]!` (`platform.admins.view`; `appId` null = konteks global)
- `Role { id: ID!, name, description, scopeType, appId: ID, permissionKeys: [String!]! }`; `Admin { id, name, email, isSuperAdmin, isActive }`; `AdminConnection { items, totalCount }` via `PaginatedType`.

- [ ] **Step 1: Tulis spec metadata gagal** `resolver-metadata.spec.ts`: via `Reflector`, tiap method mutasi di atas membawa metadata `permissions` tepat (§Interfaces); tiap resolver class memakai guard `AuthGuard, PermissionGuard` (atau hanya `AuthGuard` untuk `currentAdmin`).
```typescript
it("mengunci createRole di balik platform.roles.manage", () => {
  const perms = reflector.get<string[]>("permissions", RolesResolver.prototype.createRole);
  expect(perms).toEqual(["platform.roles.manage"]);
});
```
- [ ] **Step 2: RED.** Run spec Task 8. Expected: FAIL.
- [ ] **Step 3: Implementasi** tipe + input (`class-validator`; `description?` opsional) + dua resolver + wiring modul. ID string→number di service (pola Task 7).
- [ ] **Step 4: GREEN.** Run spec. Expected: PASS. Run `bun run build` (dari `apps/api`) → skema `src/schema.gql` mengandung `createRole`, `assignRole`, `effectivePermissions`, `currentAdmin` (cek via `Select-String`).
- [ ] **Step 5: Commit**
```bash
git add <files Task 8>
git commit -m "feat(api): F05 resolver GraphQL RBAC + admin"
```

### Task 9: CMS — halaman role & admin + PermissionGate

**Files:**
- Create: `apps/cms/features/rbac/graphql/roles.graphql.ts`, `admins.graphql.ts`, `permissions.graphql.ts` (dokumen handwritten, R10), `apps/cms/features/rbac/components/permission-gate.tsx`, `apps/cms/features/rbac/hooks/use-effective-permissions.ts`, `apps/cms/app/platform/roles/page.tsx`, `apps/cms/app/platform/roles/new/page.tsx`, `apps/cms/app/platform/roles/[id]/page.tsx`, `apps/cms/app/platform/admins/page.tsx`, `apps/cms/app/platform/admins/new/page.tsx`, `apps/cms/app/platform/admins/[id]/page.tsx`

**Interfaces:**
- Consumes: query/mutasi Task 8 (nama persis §Task 8); `currentAdmin` untuk `isSuperAdmin` sendiri.
- Produces: `<PermissionGate requires="platform.roles.manage" fallback?>{...}</PermissionGate>` (render children bila `currentAdmin.isSuperAdmin` ATAU `effectivePermissions(currentAdmin.id, null)` memuat key exact); `useEffectivePermissions(adminId): { keys: string[]; loading: boolean }`; halaman daftar (tabel + search + pagination skip/take) dan form (nama/deskripsi/scope/app + centang permission per kelompok modul; admin: assign multi-role + toggle aktif + panel akses-efektif).
- Galat: `FORBIDDEN` → pesan inline "Anda tidak memiliki akses untuk tindakan ini."; `UNAUTHENTICATED` tetap redirect global (tak diubah); proxy tanpa sesi → `/login` (tak diubah).

- [ ] **Step 1: Tulis dokumen GraphQL + hook + gate** (tanpa halaman dulu).
- [ ] **Step 2: RED — rute belum ada.** Run: `bun --filter cms build` (dari root). Expected: exit 0 TETAPI tabel rute TIDAK memuat `/platform/roles` (membuktikan halaman belum ada).
- [ ] **Step 3: Tulis 6 halaman** (gaya `login/page.tsx`: `"use client"`, slate Tailwind, pesan Indonesia; form role: permission dikelompokkan per `module` dari query `permissions`).
- [ ] **Step 4: GREEN.** Run: `bun --filter cms typecheck` → exit 0; `bun --filter cms lint` → exit 0; `bun --filter cms build` → exit 0 + rute `/platform/roles`, `/platform/admins` tercantum.
- [ ] **Step 5: Commit**
```bash
git add <files Task 9>
git commit -m "feat(cms): F05 halaman role, admin, dan PermissionGate"
```

### Task 10: Docs + gerbang penuh + smoke F05

**Files:**
- Modify: `features/F05-rbac-dinamis.md` (semua `- [x]`, Status Selesai), `features/README.md` (F05 Selesai), `docs/07-api-design.md` (§2 tambah baris `query currentAdmin` + `query effectivePermissions(adminId: appId:)`)

**Interfaces:** (verifikasi akhir; tanpa kode baru kecuali perbaikan temuan smoke)
- Prasyarat: `docker compose up -d` (postgres+redis), migrasi `up --scope platform` terkini, `seed:admin` super, `seed:demo-apps`.

- [ ] **Step 1: Smoke API — peran & guard.** Sebagai super: `createRole` global "Operator" (`platform.apps.view`) → OK; `createAdmin` operator@mail → OK; `assignRole` → OK. Login operator: `query admins` → `FORBIDDEN` + `requiredPermission: "platform.admins.view"`; `query roles` → `FORBIDDEN` + `platform.roles.view`. Cakup kriteria 2 F05: operator memanggil langsung = ditolak.⁻
- [ ] **Step 2: Smoke API — cakupan app + cache.** Sebagai super: `createRole` app "Editor Soal" (app tes-cpns, `platform.users.view`) → OK; `assignRole` ke operator + appId → OK; `effectivePermissions(operator, appTesCpns)` memuat `platform.users.view` (kriteria 1); `unassignRole` → `effectivePermissions` langsung kosong TANPA tunggu TTL (invalidasi sinkron, kriteria 3).
- [ ] **Step 3: Smoke API — proteksi + nonaktif.** `setAdminActive(super,false)` → pesan "Super Admin aktif terakhir" (kriteria 4); `setAdminActive(operator,false)` → OK; request operator berikutnya → `UNAUTHENTICATED` (sesi dicabut).
- [ ] **Step 4: Smoke CMS.** Dev CMS: `/platform/roles` tanpa sesi → redirect `/login`; dengan sesi super → 200 + daftar memuat "Operator"; `/platform/admins` → 200; aksi hapus role ber-penetapan menampilkan galat jelas (uji manual sekali via UI).
- [ ] **Step 5: Gerbang penuh + sinkron docs.** Run gerbang (Constraints) → exit 0 semua. Balik status/docs (§Files). Commit docs:
```bash
git add features/ docs/07-api-design.md
git commit -m "docs: tandai F05 selesai + catat query currentAdmin dan effectivePermissions"
```

⁻ *Smoke dijalankan berurutan dalam satu sesi shell; cookie tiap admin di jar terpisah. Perintah persis mengikuti preseden smoke F01 (Invoke-RestMethod ke `/graphql`).*
