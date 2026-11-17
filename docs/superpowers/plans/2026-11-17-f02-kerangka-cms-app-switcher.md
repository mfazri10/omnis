# F02 Kerangka CMS & App Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shell CMS (sidebar, header, app switcher) + konteks request `X-App-Slug` tervalidasi server (Auth → AppContext → Permission).

**Architecture:** Backend: `AppContextGuard` baru (marker `@AppScoped()`) memvalidasi slug → status → hak, menulis konteks tervalidasi ke request; `PermissionGuard` meneruskan `appId` konteks; interceptor App DB resolve dari konteks tervalidasi. Query sesi auth-only `myApps` / `myPermissions` + probe `appContext` menjadi kontrak guard. CMS: rute pindah ke grup `(shell)`, slug aktif bagian dari URL `/[appSlug]`, zustand menyimpan sesi + slug persisten, Apollo menyisipkan header otomatis.

**Tech Stack:** NestJS + GraphQL code-first + Drizzle (API); Next.js App Router + Apollo Client + zustand + Tailwind (CMS).

**Spec:** `features/F02-kerangka-cms-app-switcher.md` (mewajibkan FR-PLAT-02; acuan `docs/03` A2, `docs/05` §4.1, `docs/07` §1).

## Global Constraints

- TypeScript `strict`, tanpa `any`, `import type` eksplisit untuk tipe.
- ID GraphQL `string` (bigint → string); pesan user Bahasa Indonesia; copy UI Bahasa Indonesia.
- Urutan guard: `AuthGuard` → `AppContextGuard` → `PermissionGuard`; operasi global mengabaikan `X-App-Slug` (doc 07 §1).
- TDD: tulis tes gagal dulu, lihat gagal, implementasi minimal, lihat hijau; komit per task selesai.
- Error code stabil via `GraphqlExceptionFilter`: `APP_NOT_FOUND`, `APP_SUSPENDED`, `FORBIDDEN`, `BAD_USER_INPUT`, `UNAUTHENTICATED`.
- Dokumen GraphQL CMS handwritten mengikuti pola `features/*/graphql/*.graphql.ts` (codegen di luar scope).
- Jangan komit secret/env; lockfile tetap di-komit; push oleh user.

## Review Focus

- Slug persisten basi (aplikasi diarsip/dihapus setelah slug tersimpan) → CMS kembali ke pemilih + toast, bukan crash/loop. (Tes: smoke CMS Task 6.)
- Aplikasi di-suspend di tengah sesi → request berikut `APP_SUSPENDED` → pemilih + toast. (Tes: smoke CMS Task 6.)
- Header spoof pada operasi global (`X-App-Slug` fiktif/terlarang di query `apps`) → diabaikan, operasi jalan dengan hak global. (Tes: smoke API Task 6.)
- `myPermissions` untuk aplikasi di luar hak → mengembalikan kunci (mungkin kosong) tanpa data admin lain; operasi app-scoped tetap ditolak (kriteria 3 end-to-end). (Tes: smoke API Task 6.)
- Pindah aplikasi saat query in-flight → respons basi tidak menimpa konteks baru (fetch `network-only` + konteks dari route). (Tes: smoke CMS Task 6: switch dua kali cepat, konten akhir milik aplikasi kedua.)

---

### Task 0: Branch + baseline + rekon

**Files:** (operasi git; tanpa file kode)

- [ ] **Step 1: Buat branch dari tip F03**

Run: `git checkout -b feature/F02-kerangka-cms-app-switcher feature/F03-registry-provisioning`
Expected: branch aktif baru; `git log --oneline -1` sama dengan tip F03.

- [ ] **Step 2: Baseline gerbang API**

Run: `cd apps/api && bun run typecheck && bun run lint && bun run test`
Expected: exit 0 semua; catat jumlah suite/tes.

- [ ] **Step 3: Baseline gerbang CMS**

Run: `cd apps/cms && bun run typecheck && bun run lint && bun run build`
Expected: exit 0 semua.

- [ ] **Step 4: Rekon smoke CMS**

Cek: `npx playwright --version` (atau `bunx playwright --version`) dan browser terinstal.
Expected: catat `playwright-tersedia: ya/tidak` → bila tidak, smoke CMS Task 6 memakai jalur HTTP (login page 200, `/` redirect tanpa cookie, `/platform/apps` + `/tes-cpns` 200 dengan cookie, `/slug-asing` mengandung teks 403).

- [ ] **Step 5: Rekon data dev**

Run: `docker compose exec -T postgres psql -U postgres -d platform -tAc "SELECT slug, status FROM apps ORDER BY 1;"`
Expected: catat aplikasi demo yang ada (smoke Task 6 memakai/membuat sesuai kebutuhan, teardown membersihkan buatannya).

### Task 1: AppContextGuard + marker @AppScoped

**Files:**
- Create: `apps/api/src/common/decorators/app-scoped.decorator.ts`
- Create: `apps/api/src/common/guards/app-context.guard.ts`
- Create: `apps/api/src/common/decorators/app-context.decorator.ts`
- Modify: `apps/api/src/common/types/request-context.ts`
- Test: `apps/api/src/common/guards/app-context.guard.spec.ts`

**Interfaces:**
- Consumes: `ADMIN_KEY` (`common/guards/auth.guard.ts`), `AppsRepository.findBySlug`, `AssignmentsRepository.listByAdmin`, `AppNotFoundException` / `AppSuspendedException` (`common/exceptions/app.exceptions.ts`).
- Produces: `APP_SCOPED_KEY = "appScoped"`, `AppScoped()` decorator; `APP_CONTEXT_KEY = "appContext"`; `interface AppContext { appId: string; slug: string; name: string; status: AppStatus; dbName: string }`; `AppContextGuard implements CanActivate`; `AppContext()` param decorator → `AppContext`.

- [ ] **Step 1: Tulis spec gagal `app-context.guard.spec.ts`** — 11 kasus: (1) tanpa marker `@AppScoped` → `true` meski header ada; (2) marker + header hilang → `BadRequestException` "Konteks aplikasi wajib diisi (header X-App-Slug)."; (3) slug fiktif → `AppNotFoundException`; (4) non-super + `suspended` → `AppSuspendedException`; (5) non-super + `archived`/`provisioning`/`failed` → `AppSuspendedException`; (6) non-super tanpa grant → `ForbiddenException` "Anda tidak memiliki akses ke aplikasi ini."; (7) super admin + `suspended` → `true`; (8) super admin + `archived` → `AppSuspendedException`; (9) grant global → `true`; (10) grant app pada aplikasi itu → `true`; (11) sukses menulis `req[APP_CONTEXT_KEY]` = `{ appId: "7", slug, name, status, dbName }`. Mock `Reflector`, `DatabaseService.getControlPlaneConnection`, `AppsRepository`, `AssignmentsRepository` gaya `Mocked<T>`; bangun `ExecutionContext` GraphQL palsu minimal.

- [ ] **Step 2: Jalankan spec, pastikan gagal**

Run: `cd apps/api && bun run test -- src/common/guards/app-context.guard.spec.ts`
Expected: FAIL (modul guard belum ada).

- [ ] **Step 3: Implementasi `APP_SCOPED_KEY` + `AppScoped()`** di `app-scoped.decorator.ts` via `SetMetadata`; tambah `APP_CONTEXT_KEY` + `interface AppContext` di `request-context.ts` (impor tipe `AppStatus` dari `modules/platform/entities/apps.entity`).

- [ ] **Step 4: Implementasi `AppContextGuard`** — baca metadata `APP_SCOPED_KEY` (handler + class); bila tidak bertanda → `true`. Bila bertanda: baca admin dari `req[ADMIN_KEY]` (bentuk `{ id: string; isSuperAdmin: boolean }`, absen → `UnauthorizedException` pesan sesi baku); baca header `x-app-slug` (GraphQL via `GqlExecutionContext`, HTTP via `switchToHttp`, pola `AuthGuard`); validasi berurutan: header → `findBySlug` → status (`active` lolos; `suspended` lolos hanya untuk super; `archived`/`provisioning`/`failed` selalu ditolak) → hak (super/grant global/grant app cocok). Tulis konteks, `return true`.

- [ ] **Step 5: Implementasi `AppContext()` param decorator** (GraphQL + HTTP, pola `CurrentAdmin`).

- [ ] **Step 6: Jalankan spec + gerbang**

Run: `cd apps/api && bun run test -- src/common/guards/app-context.guard.spec.ts && bun run typecheck && bun run lint`
Expected: 11/11 PASS; typecheck + lint exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/common/decorators/app-scoped.decorator.ts apps/api/src/common/decorators/app-context.decorator.ts apps/api/src/common/guards/app-context.guard.ts apps/api/src/common/guards/app-context.guard.spec.ts apps/api/src/common/types/request-context.ts
git commit -m "feat(api): F02 AppContextGuard + marker @AppScoped"
```

### Task 2: Rangkaian guard + interceptor konteks tervalidasi

**Files:**
- Modify: `apps/api/src/common/guards/permission.guard.ts`
- Modify: `apps/api/src/common/interceptors/app-database.interceptor.ts`
- Modify: `apps/api/src/modules/platform/apps/apps.resolver.ts`
- Modify: `apps/api/src/common/guards/permission.guard.spec.ts`
- Modify: `apps/api/src/modules/platform/rbac/resolver-metadata.spec.ts`
- Test: `apps/api/src/common/interceptors/app-database.interceptor.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`APP_CONTEXT_KEY`, `AppContext`, `AppContextGuard`, `APP_SCOPED_KEY`).
- Produces: `PermissionGuard` meneruskan `appId` konteks ke `RbacService.hasPermission`; `AppDatabaseInterceptor` resolve pool dari konteks tervalidasi saja; `AppsResolver` terkunci `AuthGuard, AppContextGuard, PermissionGuard` (urutan itu).

- [ ] **Step 1: Tambah kasus gagal ke `permission.guard.spec.ts`** — (1) ada `req[APP_CONTEXT_KEY] = { appId: "7", ... }` → `rbac.hasPermission` dipanggil dengan `(admin, key, "7")`; (2) tanpa konteks → dipanggil dengan `(admin, key, undefined)`. Perbarui komentar basi "Konteks app (F02) belum ada" belakangan di Step 3.

- [ ] **Step 2: Tulis spec gagal `app-database.interceptor.spec.ts`** — (1) ada konteks tervalidasi → `getAppConnection(slug-konteks)` dipanggil dan `req[APP_DB_KEY]` terisi; (2) header mentah ada tapi konteks absen → `getAppConnection` TIDAK dipanggil, `req[APP_DB_KEY]` kosong (operasi global abaikan header); (3) konteks non-GraphQL → teruskan.

- [ ] **Step 3: Jalankan kedua spec, pastikan gagal**

Run: `cd apps/api && bun run test -- src/common/guards/permission.guard.spec.ts src/common/interceptors/app-database.interceptor.spec.ts`
Expected: FAIL (perilaku baru belum ada).

- [ ] **Step 4: Implementasi** — `PermissionGuard`: baca `req[APP_CONTEXT_KEY]` (GraphQL + HTTP), teruskan `appId`-nya (atau `undefined`) ke `hasPermission`; ganti komentar F02-belum-ada. `AppDatabaseInterceptor`: hapus jalur header mentah; resolve hanya dari `APP_CONTEXT_KEY`; perbarui komentar. `AppsResolver`: `@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)`.

- [ ] **Step 5: Perbarui `resolver-metadata.spec.ts`** — `AppsResolver` memuat ketiga guard urut (`AuthGuard`, `AppContextGuard`, `PermissionGuard`); tambah helper `scopedOf()`. Kasus metadata metode `appContext` ditulis di Task 3 bersama metodenya.

- [ ] **Step 6: Jalankan suite API penuh + gerbang**

Run: `cd apps/api && bun run test && bun run typecheck && bun run lint`
Expected: semua suite PASS (global interceptor yang dikeraskan tidak merusak operasi global); typecheck + lint exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/common/guards/permission.guard.ts apps/api/src/common/guards/permission.guard.spec.ts apps/api/src/common/interceptors/app-database.interceptor.ts apps/api/src/common/interceptors/app-database.interceptor.spec.ts apps/api/src/modules/platform/apps/apps.resolver.ts apps/api/src/modules/platform/rbac/resolver-metadata.spec.ts
git commit -m "feat(api): F02 rantai guard appId + interceptor konteks tervalidasi"
```

### Task 3: Query sesi myApps / myPermissions / appContext

**Files:**
- Create: `apps/api/src/modules/platform/apps/types/app-context.type.ts`
- Modify: `apps/api/src/modules/platform/apps/apps.repository.ts`
- Modify: `apps/api/src/modules/platform/apps/apps.service.ts`
- Modify: `apps/api/src/modules/platform/apps/apps.resolver.ts`
- Modify: `apps/api/src/modules/platform/admins/admins.service.ts`
- Modify: `apps/api/src/modules/platform/admins/admins.resolver.ts`
- Modify: `apps/api/src/modules/platform/apps/apps.service.spec.ts`
- Modify: `apps/api/src/modules/platform/admins/admins.service.spec.ts`
- Modify: `apps/api/src/modules/platform/rbac/resolver-metadata.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`AppScoped`, `AppContext`, `AppContext()`), `AssignmentsRepository.listByAdmin`, `RbacService.listEffectivePermissions`.
- Produces: `AppsRepository.findByIds(db, ids: number[]): Promise<AppRow[]>` (urut nama); `AppsService.listAccessibleApps(profile: { id: string; isSuperAdmin: boolean }): Promise<AppDetail[]>`; `AdminsService.listOwnPermissions(profile: { id: string; isSuperAdmin: boolean }, appId?: string): Promise<string[]>`; query `myApps: [AppType!]!`, `myPermissions(appId: ID): [String!]!`, `appContext: AppContextType!` (ketiganya auth-only, tanpa `@RequirePermissions`; `appContext` bertanda `@AppScoped()`); `AppContextType { id: ID!, slug: String!, name: String!, status: String! }`.

Aturan `listAccessibleApps`: super → `active` + `suspended` (kecualikan `archived`/`provisioning`/`failed`); non-super dengan ≥1 grant global → semua `active`; non-super lain → `active` yang `appId`-nya ada di grant-nya. Urut nama.

Aturan `listOwnPermissions`: tanpa `appId` → `listEffectivePermissions(id, undefined)`; dengan `appId` → aplikasi harus ada (`NotFoundException` "Aplikasi tidak ditemukan.") dan bila non-`active` + non-super → `AppSuspendedException`; lalu `listEffectivePermissions(id, appId)`.

- [ ] **Step 1: Tambah kasus gagal ke `apps.service.spec.ts`** — `listAccessibleApps`: (1) super → `active` + `suspended`, tanpa `archived`; (2) grant global → semua `active`; (3) grant 1 app → hanya app itu (kriteria 1); (4) tanpa grant → `[]`. Tambah `AssignmentsRepository` ke `Mocked` helper + `findByIds` ke helper `AppsRepository`.

- [ ] **Step 2: Tambah kasus gagal ke `admins.service.spec.ts`** — `listOwnPermissions`: (1) tanpa appId → teruskan `(id, undefined)`; (2) appId fiktif → `NotFoundException`; (3) non-super + app `suspended` → `AppSuspendedException`; (4) super + `suspended` → teruskan `(id, appId)`. Tambah `AppsRepository` ke helper service-nya.

- [ ] **Step 3: Jalankan kedua spec, pastikan gagal**

Run: `cd apps/api && bun run test -- src/modules/platform/apps/apps.service.spec.ts src/modules/platform/admins/admins.service.spec.ts`
Expected: FAIL (metode belum ada).

- [ ] **Step 4: Implementasi** — `AppsRepository.findByIds` (`inArray` + `orderBy(apps.name)`); `AppsService` tambah dep `AssignmentsRepository` + `listAccessibleApps`; `AdminsService` tambah dep `AppsRepository` + `listOwnPermissions`; `AppContextType` code-first; `AppsResolver.myApps` (`@CurrentAdmin()` → service, tanpa permission), `AppsResolver.appContext` (`@AppScoped()` + `@AppContext() ctx` → `{ id: ctx.appId, slug, name, status }`, tanpa permission); `AdminsResolver.myPermissions` (`@CurrentAdmin()` + `appId` nullable → service, tanpa permission). Perbarui semua helper `Mocked<AppsRepository>` / `Mocked<AdminsService>`-terkait yang pecah karena dep baru (kompilasi spec).

- [ ] **Step 5: Tambah kasus metadata** ke `resolver-metadata.spec.ts` — `myApps`/`myPermissions`/`appContext` tanpa metadata permission (pola `currentAdmin`); `appContext` bertanda `@AppScoped` via `scopedOf()`; metode lain `AppsResolver`/`AdminsResolver` tidak bertanda (iterasi daftar metode lama → `scopedOf()` undefined).

- [ ] **Step 6: Jalankan suite API penuh + gerbang + boot skema**

Run: `cd apps/api && bun run test && bun run typecheck && bun run lint && bun run build`
Expected: semua PASS; skema memuat `myApps`, `myPermissions`, `appContext` (cek via `bun run build` sukses + grep skema bila tercetak; minimal boot tanpa error decorator).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/platform/apps/types/app-context.type.ts apps/api/src/modules/platform/apps/apps.repository.ts apps/api/src/modules/platform/apps/apps.service.ts apps/api/src/modules/platform/apps/apps.resolver.ts apps/api/src/modules/platform/apps/apps.service.spec.ts apps/api/src/modules/platform/admins/admins.service.ts apps/api/src/modules/platform/admins/admins.resolver.ts apps/api/src/modules/platform/admins/admins.service.spec.ts apps/api/src/modules/platform/rbac/resolver-metadata.spec.ts
git commit -m "feat(api): F02 query sesi myApps/myPermissions/appContext"
```

### Task 4: CMS — rute shell + store sesi + Apollo konteks

**Files:**
- Move: `apps/cms/app/platform/**` → `apps/cms/app/(shell)/platform/**` (9 page, impor relatif naik satu tingkat `../`)
- Move: `apps/cms/app/page.tsx` → hapus, ganti `apps/cms/app/(shell)/page.tsx` (pemilih aplikasi)
- Create: `apps/cms/app/(shell)/layout.tsx`
- Create: `apps/cms/app/(shell)/platform/layout.tsx`
- Create: `apps/cms/app/(shell)/403/page.tsx`
- Create: `apps/cms/stores/use-session-store.ts`
- Create: `apps/cms/stores/use-toast-store.ts`
- Create: `apps/cms/components/shared/toaster.tsx`
- Create: `apps/cms/features/shell/graphql/session.graphql.ts`
- Modify: `apps/cms/lib/apollo-client.ts` (header link + error link)
- Modify: `apps/cms/app/layout.tsx` (pasang `Toaster`)

**Interfaces:**
- Consumes: query `currentAdmin`, `myApps`, `myPermissions` (Task 3).
- Produces: `useSessionStore` (zustand + `persist` `activeSlug`): `{ admin: AdminData | null; accessibleApps: AccessibleApp[]; activeSlug: string | null; permissions: string[]; permissionsContext: "global" | string; ready: boolean; setSession(...); setActiveSlug(...); setPermissions(...); reset(); }` dengan `AccessibleApp = { id: string; slug: string; name: string; status: string; iconMediaUrl: string | null }`; `useToastStore { toasts: { id: number; message: string }[]; push(message: string): void; dismiss(id: number): void }`; dokumen `CURRENT_ADMIN_QUERY` (reuse dari rbac), `MY_APPS_QUERY`, `MY_PERMISSIONS_QUERY`.

Perilaku `(shell)/layout.tsx` (client): query `currentAdmin` → `myApps` → `myPermissions(appId aktif ?? null)`; tulis store; `ready=true`; render `{children}` (Sidebar/Header menyusul Task 5 — di sini render children polos + pemuat "Menyiapkan sesi…"). `platform/layout.tsx` (client): `setActiveSlug(null)` saat mount. `403/page.tsx`: "Anda tidak memiliki akses." + tautan ke `/`. `(shell)/page.tsx`: kartu per `accessibleApps` (nama, slug, status) → tautan `/[slug]`; kosong → "Anda belum memiliki akses ke aplikasi apa pun."; error → pesan + tombol muat ulang.

Perilaku `apollo-client.ts`: sisipkan context link sebelum `HttpLink` membaca `useSessionStore.getState().activeSlug` → header `X-App-Slug` bila non-null; perluas `errorLink`: `FORBIDDEN` → `window.location.href = "/403"` (kecuali sudah di sana); `APP_NOT_FOUND`/`APP_SUSPENDED` → `push(toast penjelasan)` + redirect `/`; pertahankan `UNAUTHENTICATED` → `/login`. Hapus `NOTE(F02)`.

`proxy.ts` TIDAK berubah (cek ringan hak global di proxy diputuskan TIDAK — Ruling T4: proxy hanya presence-check; penegakan final di API).

- [ ] **Step 1: Pindahkan rute + perbaiki impor** — `git mv apps/cms/app/platform "apps/cms/app/(shell)/platform"` (tanda kutip wajib: PowerShell mengartikan kurung); di tiap page pindahan tambah satu `../` pada impor relatif ke `features/` (9 berkas).

- [ ] **Step 2: Tulis store + dokumen GraphQL + Toaster** — `use-session-store.ts` (zustand `create` + `persist` partialize `{ activeSlug }`, key `"cms-session"`); `use-toast-store.ts`; `session.graphql.ts` (`MY_APPS_QUERY { myApps { id slug name status iconMediaUrl } }`, `MY_PERMISSIONS_QUERY($appId: ID) { myPermissions(appId: $appId) }`); `toaster.tsx` (client, baca toast store, tombol tutup).

- [ ] **Step 3: Tulis layout + halaman** — `(shell)/layout.tsx`, `(shell)/platform/layout.tsx`, `(shell)/403/page.tsx`, `(shell)/page.tsx` (hapus `app/page.tsx` lama); pasang `Toaster` di `app/layout.tsx`.

- [ ] **Step 4: Ubah `apollo-client.ts`** — context link header + error link perluasan + hapus NOTE(F02).

- [ ] **Step 5: Gerbang CMS**

Run: `cd apps/cms && bun run typecheck && bun run lint && bun run build`
Expected: exit 0; rute `/`, `/403`, `/platform/*` terdaftar di output build.

- [ ] **Step 6: Commit**

```bash
git add apps/cms/app apps/cms/stores apps/cms/components apps/cms/features/shell apps/cms/lib/apollo-client.ts
git commit -m "feat(cms): F02 rute shell + store sesi + Apollo konteks"
```

### Task 5: CMS — sidebar + switcher + gate + rute [appSlug]

**Files:**
- Create: `apps/cms/features/shell/menu.ts`
- Create: `apps/cms/components/shared/sidebar.tsx`
- Create: `apps/cms/components/shared/app-switcher.tsx`
- Create: `apps/cms/components/shared/shell-header.tsx`
- Create: `apps/cms/app/(shell)/[appSlug]/layout.tsx`
- Create: `apps/cms/app/(shell)/[appSlug]/page.tsx`
- Modify: `apps/cms/app/(shell)/layout.tsx` (pasang Sidebar + ShellHeader)
- Modify: `apps/cms/features/rbac/components/permission-gate.tsx` (baca store)

**Interfaces:**
- Consumes: Task 4 (`useSessionStore`, toast, dokumen sesi).
- Produces: `MenuItem { key: string; label: string; href: string | null; requires: string | null; status: "live" | "soon" }`; `GLOBAL_MENU: MenuItem[]` (Aplikasi `/platform/apps` requires `platform.apps.view`; Admin `/platform/admins` requires `platform.admins.view`; Role `/platform/roles` requires `platform.roles.view`; Audit Log `soon`); `appMenu(slug: string): MenuItem[]` (Dasbor `/[slug]` requires null live; Pengguna/Media/Kampanye/Pengaturan `soon` requires `platform.users.view`/`platform.media.view`/`platform.notifications.view`/`platform.app-config.view`).

Perilaku: `Sidebar` (client): seksi Global (filter `requires` vs store.permissions; `null` tampil) + seksi aplikasi aktif bila `activeSlug` (filter sama; `soon` → label + lencana "Segera", tanpa tautan). `AppSwitcher` (client): dropdown `accessibleApps`; pilih → `router.push("/[slug]")`; pilihan aktif = `activeSlug`. `ShellHeader` (client): `AppSwitcher` + nama/email admin + tautan "Ubah kata sandi" + tombol "Keluar" (`authClient.signOut()` → `router.push("/login")` + `refresh`). `[appSlug]/layout.tsx` (client): `setActiveSlug(params.appSlug)`; validasi slug ∈ `accessibleApps` (setelah `ready`) → tidak ada → render 403 inline (pesan + tautan `/`); slug basi persisten dibersihkan (`setActiveSlug(null)` + toast + `router.replace("/")`). `[appSlug]/page.tsx`: nama + status aplikasi, jumlah permission efektif, tautan cepat (TODO F07 dasbor penuh). `PermissionGate`: baca `ready`/`admin`/`permissions` dari store (tanpa query); API props tetap (`requires`, `fallback`, `children`); hapus NOTE(F02).

- [ ] **Step 1: Tulis `menu.ts` + `Sidebar` + `AppSwitcher` + `ShellHeader`.**

- [ ] **Step 2: Tulis `[appSlug]/layout.tsx` + `[appSlug]/page.tsx`; pasang Sidebar + Header di `(shell)/layout.tsx`.**

- [ ] **Step 3: Refaktor `PermissionGate` ke store** (hapus query ganda + NOTE(F02)).

- [ ] **Step 4: Gerbang CMS**

Run: `cd apps/cms && bun run typecheck && bun run lint && bun run build`
Expected: exit 0; rute `/[appSlug]` terdaftar; halaman platform lama tetap lolos kompilasi dengan gate baru.

- [ ] **Step 5: Commit**

```bash
git add apps/cms/features/shell/menu.ts apps/cms/components/shared/sidebar.tsx apps/cms/components/shared/app-switcher.tsx apps/cms/components/shared/shell-header.tsx "apps/cms/app/(shell)/[appSlug]" "apps/cms/app/(shell)/layout.tsx" apps/cms/features/rbac/components/permission-gate.tsx
git commit -m "feat(cms): F02 sidebar + switcher + gate + rute appSlug"
```

### Task 6: Docs + gerbang + smoke

**Files:**
- Create: `.tmp/smoke-f02-api.ps1` (tak ter-version; pola `.tmp/smoke-f03-api.ps1`)
- Create: `.tmp/smoke-f02-cms.mjs` (playwright; atau `.tmp/smoke-f02-cms.ps1` jalur HTTP bila rekon Task 0 negatif)
- Modify: `features/F02-kerangka-cms-app-switcher.md`, `features/README.md`

**Interfaces:** — (verifikasi end-to-end Task 1–5).

- [ ] **Step 1: Smoke API** — skrip login super → siapkan admin terbatas (1 app via `createAdmin` + `createRole` app-scope + `assignRole`; admin kedua beda role di 2 app) → asersi: (1) `myApps` super ⊇ demo; terbatas-1 = 1 app; (2) `appContext` tanpa header → `BAD_USER_INPUT`; fiktif → `APP_NOT_FOUND`; suspended (suspend lalu kembalikan) → terbatas `APP_SUSPENDED`, super OK; luar hak → `FORBIDDEN`; (3) `apps` + header spoof fiktif → tetap OK (diabaikan); (4) `myPermissions` berbeda per app untuk admin kedua. Teardown: kembalikan suspend; hapus admin/role/aplikasi buatan smoke via SQL langsung (registry + configs + DB).

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File .tmp/smoke-f02-api.ps1`
Expected: `SMOKE-API-F02-HIJAU`.

- [ ] **Step 2: Smoke CMS** (playwright bila tersedia) — login → pemilih memuat kartu demo → klik app → URL `/[slug]` + nama app di header + menu konteks → switch via dropdown → URL + konten berubah → kunjungi `/slug-asing-xyz` → teks 403 → switch dua kali cepat → konten akhir milik app kedua → suspend app aktif dari API → refresh → kembali ke pemilih + toast → logout → `/login`.

Run: `node .tmp/smoke-f02-cms.mjs` (atau skrip `.ps1` jalur HTTP)
Expected: `SMOKE-CMS-F02-HIJAU`.

- [ ] **Step 3: Update docs** — `features/F02-kerangka-cms-app-switcher.md`: Status `Selesai`, semua checkbox `[x]`; `features/README.md`: baris F02 → Selesai. `docs/05` §4.1 + `docs/07` §1 sudah menggambarkan perilaku ini — verifikasi tanpa drift, tanpa ubah.

- [ ] **Step 4: Gerbang penuh**

Run: `cd apps/api && bun run typecheck && bun run lint && bun run test && bun run build` lalu `cd ../cms && bun run typecheck && bun run lint && bun run build`
Expected: exit 0 semua.

- [ ] **Step 5: Commit docs**

```bash
git add features/F02-kerangka-cms-app-switcher.md features/README.md
git commit -m "docs: tandai F02 selesai"
```
