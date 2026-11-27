# Redesign UI CMS (Pendekatan C) — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satukan shell CMS (header breadcrumb + sidebar ikon + akun di footer) dan pola tabel (`DataTable` di semua halaman daftar), bersihkan kelas mentah, tanpa menyentuh logika sesi/permission/GraphQL.

**Architecture:** Lapisan presentasi saja. Shell memakai primitif sidebar shadcn yang sudah ada plus `SidebarInset`, breadcrumb turunan pathname, dan `NavUser` di `SidebarFooter`. Halaman daftar dimigrasi ke `DataTable` yang sudah ada; kolom dan aksi disalin dari markup masing-masing. Nama aksesibel yang diikat e2e tidak berubah.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui base-nova (Base UI), lucide-react, TanStack Table, Apollo Client, Zustand, bun:test + Playwright e2e.

**Spec:** [docs/superpowers/specs/2026-11-28-cms-ui-redesign-design.md](../specs/2026-11-28-cms-ui-redesign-design.md). Baseline kondisi saat ini: [refactor-design/implementasi-saat-ini.md](../../../refactor-design/implementasi-saat-ini.md).

## Global Constraints

- Nama aksesibel yang diikat e2e tidak boleh berubah: `Menu utama`, `Pilih aplikasi` (combobox) + opsi nama aplikasi, `Soal CBT`/`Media`/`Admin`, heading (`Bank soal`, `Perpustakaan media`, `Anda tidak memiliki akses`, nama aplikasi di dasbor), label form (`Pertanyaan (wajib)`, `Judul (wajib)`, `Kunci jawaban (wajib)`, `Opsi A-C (wajib)`, `Paket aktif (wajib)`), tombol (`Tambah soal`, `Tambah paket`, `Simpan`, `Simpan komposisi`, `Komposisi`, `Aktifkan`, `Nonaktifkan`, `Mulai simulasi`, `Mulai sesi`, `Pilih media`, `Masuk`, `Akun`, `Ubah kata sandi`, `Keluar`), dialog `Pilih media` + `Cari media`.
- Copy Bahasa Indonesia; tanpa karakter em dash (`—`) pada teks baru (aturan antislop R-02); tanpa emoji; tanpa angka/klaim palsu.
- Target sentuh `min-h-11` (44px) pada kontrol; fokus via `--ring` (outline bawaan globals.css); tanpa warna aksen baru di luar token teal.
- Semua kelas gaya memakai token semantik (`bg-card`, `text-muted-foreground`, `border-border`, dst.); `slate-` dilarang di kode halaman/fitur (substring `translate` bukan kelas slate, jangan salah flag).
- Query/mutasi GraphQL, variabel filter, logika pagination/reset halaman, permission, provisioning, dan toast tidak diubah.
- Halaman landing `(public)` dan `(auth)` tidak disentuh.
- Komponen baru hanya dari registry shadcn base-nova via `bunx shadcn add <nama>` di `apps/cms`; ikon hanya lucide-react.
- Setelah tiap tugas: `bunx turbo run typecheck lint --filter=cms` harus lulus sebelum commit.

## Review Focus

| Risiko | Uji yang memilikinya |
| --- | --- |
| Menu akun tak terjangkau di ponsel (drawer tertutup, 320px) setelah pindah ke footer sidebar | Task 2: alur e2e `production-readiness` diperbarui membuka drawer `Menu utama` dulu, lalu `Akun`; e2e lulus |
| Breadcrumb crash/konteks palsu untuk slug asing atau rute tanpa menu | Task 1: unit test `buildBreadcrumb` kasus slug asing (hasil `[]`) dan rute statis; Task 2: halaman 403 tetap dirender layout `[appSlug]` |
| Header sticky menutupi target skip link `#cms-content` | Task 2: `scroll-mt-*` pada `#cms-content`; verifikasi manual keyboard skip link |
| Filter diterapkan saat halaman > 1: reset ke halaman 1 hilang saat migrasi tabel | Task 4-8: logika halaman (`handleApply`/`useBoundedPage`) tidak diubah, hanya render; e2e `production-readiness` (pola halaman admin) sebagai pembanding |
| Aksi baris (`Komposisi`, `Aktifkan`, `Nonaktifkan`) hilang/berubah nama saat pindah ke `DataTable` | Task 6: kolom aksi disalin utuh; e2e `production-readiness` baris 97-104 sebagai jaring pengaman |

---

### Task 1: Primitif breadcrumb + `buildBreadcrumb` (TDD)

**Files:**
- Create: `apps/cms/components/ui/breadcrumb.tsx` (via CLI)
- Create: `apps/cms/components/shared/breadcrumbs.tsx`
- Test: `apps/cms/components/shared/breadcrumbs.test.ts`

**Interfaces:**
- Produces: `type BreadcrumbItem = { label: string; href: string | null }` (null = halaman aktif); `buildBreadcrumb(pathname: string, apps: ReadonlyArray<{ slug: string; name: string }>): BreadcrumbItem[]`; komponen `Breadcrumbs(): JSX.Element` (client, memakai `usePathname` + `useSessionStore.accessibleApps`).

- [ ] **Step 1: Tambah primitif breadcrumb**

Run (di `apps/cms`): `bunx shadcn add breadcrumb`
Expected: `components/ui/breadcrumb.tsx` dibuat; tidak ada perubahan file lain.

- [ ] **Step 2: Tulis unit test gagal**

Test bun:test untuk `buildBreadcrumb`, kasus minimal:
1. `/platform/apps` → `[{ label: "Platform", href: "/platform/pilih-aplikasi" }, { label: "Aplikasi", href: null }]`
2. `/tes-cpns/cbt/soal` dengan `apps=[{slug:"tes-cpns",name:"Tes CPNS"}]` → `[{ label: "Tes CPNS", href: "/tes-cpns" }, { label: "Soal CBT", href: null }]`
3. `/profile/change-password` → `[{ label: "Platform", href: "/platform/pilih-aplikasi" }, { label: "Ubah kata sandi", href: null }]`
4. `/platform/pilih-aplikasi` → `[{ label: "Pilih aplikasi", href: null }]`
5. `/platform/apps/new` → `[{ label: "Platform", href: "/platform/pilih-aplikasi" }, { label: "Aplikasi baru", href: null }]`
6. `/platform/admins/123` → `[{ label: "Platform", href: "/platform/pilih-aplikasi" }, { label: "Detail admin", href: null }]`
7. `/slug-asing/users` (slug tidak ada di `apps`) → `[]`
8. `/platform/apps/tes-cpns` → `[{ label: "Platform", href: "/platform/pilih-aplikasi" }, { label: "Detail aplikasi", href: null }]`

Aturan label halaman (implementasi di `breadcrumbs.tsx`): urutan keputusan (a) peta statis eksak, (b) cocok menu (`GLOBAL_MENU`/`appMenu(slug, modules)` via exact href atau prefix, pakai aturan aktif menu yang sama dengan sidebar), (c) awalan dinamis: `/platform/admins/*` non-eksak → "Detail admin", `/platform/roles/*` → "Detail role", `/platform/apps/*` → "Detail aplikasi", `/{slug}/*` tanpa menu → null, (d) tanpa keputusan → hanya tingkat konteks. Peta statis: `/platform/pilih-aplikasi` → "Pilih aplikasi", `/platform/apps/new` → "Aplikasi baru", `/platform/admins/new` → "Admin baru", `/platform/roles/new` → "Role baru", `/profile/change-password` → "Ubah kata sandi".

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run (di `apps/cms`): `bun test components/shared/breadcrumbs.test.ts`
Expected: FAIL (modul tidak ada).

- [ ] **Step 4: Implement `breadcrumbs.tsx`**

Ekspor `buildBreadcrumb` (murni, tanpa hook) dan `Breadcrumbs` (client). `Breadcrumbs` merender `Breadcrumb`/`BreadcrumbList`/`BreadcrumbItem`/`BreadcrumbLink`/`BreadcrumbSeparator`/`BreadcrumbPage` dengan `aria-label="Breadcrumb"`; item aktif pakai `BreadcrumbPage` + `aria-current="page"` (perilaku bawaan primitif).

- [ ] **Step 5: Test lulus**

Run: `bun test components/shared/breadcrumbs.test.ts`
Expected: PASS semua kasus.

- [ ] **Step 6: Typecheck + lint + commit**

Run: `bunx turbo run typecheck lint --filter=cms`
Commit: `feat(cms): primitif breadcrumb dan fungsi buildBreadcrumb`

### Task 2: Shell baru (header, sidebar, NavUser, SidebarInset)

**Files:**
- Modify: `apps/cms/features/shell/menu.ts` (field `icon`)
- Modify: `apps/cms/components/shared/sidebar.tsx`
- Modify: `apps/cms/components/shared/shell-header.tsx`
- Modify: `apps/cms/app/(shell)/layout.tsx`
- Create: `apps/cms/components/shared/nav-user.tsx`
- Modify: `apps/cms/e2e/production-readiness.test.ts` (alur Akun, sekitar baris 297)

**Interfaces:**
- Consumes: `buildBreadcrumb`/`Breadcrumbs` (Task 1).
- Produces: `MenuItem` dengan field baru `icon: LucideIcon` (komponen ikon lucide-react); `NavUser(): JSX.Element`.

- [ ] **Step 1: Tambah `icon` di `menu.ts`**

Impor ikon lucide dan tambahkan field `icon` per item sesuai tabel di spec §6.3 (Dasbor `LayoutDashboard`, Aplikasi `Smartphone`, Admin `UserCog`, Role `ShieldCheck`, Audit Log `ScrollText`, Pengguna `Users`, Media `Images`, Notifikasi `Bell`, Pengaturan `Settings`, Soal CBT `FileQuestion`, Paket CBT `Package`, Sesi CBT `CalendarClock`, Hasil CBT `ClipboardCheck`).

- [ ] **Step 2: Buat `nav-user.tsx`**

Pola nav-user `sidebar-16` dengan data produk: trigger `SidebarMenuButton size="lg"` `aria-label="Akun"` berisi chip inisial (div `rounded-full bg-muted text-muted-foreground` dua huruf pertama lokal email, uppercase, `aria-hidden`), email admin (truncate), dan ikon `ChevronsUpDown` aria-hidden. Dropdown: label email, `Ubah kata sandi` (`render={<Link href="/profile/change-password" />}`), separator, `Keluar` (salin alur `handleLogout` dari shell-header lama: signOut, reset store, push `/login`, refresh). `side={isMobile ? "bottom" : "right"}`.

- [ ] **Step 3: Ubah `sidebar.tsx`**

Header sidebar: link "CMS Platform" (bar `h-4 w-1 rounded-sm bg-primary` + teks, href picker) menggantikan "Pilih aplikasi"; tombol "Tutup menu" mobile tetap. `MenuList`: render `<item.icon aria-hidden="true" className="size-4 shrink-0" />` + label. Tambah `SidebarFooter` berisi `NavUser` (hanya saat `admin` tersedia; saat null, footer tidak dirender).

- [ ] **Step 4: Tulis ulang `shell-header.tsx`**

`<header className="sticky top-0 z-50 border-b border-border bg-card">` baris tunggal: `SidebarTrigger` (pertahankan `id="cms-sidebar-trigger"`, `aria-label="Menu utama"`, `aria-expanded`), `Separator` vertikal, `<Breadcrumbs />` dalam wadah `hidden min-w-0 sm:flex` (breadcrumb tersembunyi < `sm`), spacer `flex-1`, lalu `AppSwitcher` (tidak berubah). DropdownMenu Akun dihapus dari header.

- [ ] **Step 5: Ubah `app/(shell)/layout.tsx`**

Wadah `<div className="min-w-0 flex-1">` diganti `<SidebarInset className="min-w-0">`; `#cms-content` diberi `scroll-mt-20` agar skip link tidak tertutup header sticky. Skip link, Toaster, dan logika `CmsSession` tidak berubah.

- [ ] **Step 6: Perbarui alur e2e `production-readiness`**

Sebelum `getByRole("button", { name: "Akun", exact: true })` (baris ~297): tambahkan klik trigger `getByRole("button", { name: "Menu utama" })` untuk membuka drawer (viewport 320px), lalu klik `Akun` di dalam drawer. Label yang diuji tidak berubah.

- [ ] **Step 7: Verifikasi**

1. `bunx turbo run typecheck lint --filter=cms` → PASS.
2. `bun test` (unit) → PASS.
3. E2e penuh sesuai `apps/cms/e2e/README.md` (DB fixture disposabel) → tiga file lulus.
4. Manual: tab order header → breadcrumb → konten; Escape menutup drawer dan fokus kembali ke trigger; Ctrl/Cmd+B toggle; reload mempertahankan state sidebar (cookie); viewport 375px tanpa scroll horizontal; akun terjangkau dari drawer; skip link "Lewati ke konten" mendarat tanpa tertutup header.

- [ ] **Step 8: Commit**

Commit: `feat(cms): shell baru dengan breadcrumb, ikon menu, dan akun di footer sidebar`

### Task 3: Migrasi tabel tanpa pagination: `platform/apps` + `platform/roles`

**Files:**
- Modify: `apps/cms/app/(shell)/platform/apps/page.tsx`
- Modify: `apps/cms/app/(shell)/platform/roles/page.tsx`

**Interfaces:**
- Consumes: `DataTable` (sudah ada, tanpa perubahan); `ColumnDef` dari `@tanstack/react-table`.

- [ ] **Step 1: Ganti markup `<Table>` mentah dengan `DataTable`**

Kolom disalin dari markup halaman (label header dan sel tidak berubah, termasuk `ButtonLink "Kelola"` di apps dan aksi role). Tanpa prop `pagination` (query halaman ini mengambil semua baris). `label` = nama daftar ("Daftar aplikasi" / "Daftar role"), `emptyMessage` dipindah ke prop. Toolbar, filter, `PageHeader`, dan state halaman tetap. Tambahkan `getRowId` dari id entitas.

- [ ] **Step 2: Verifikasi**

Run: `bunx turbo run typecheck lint --filter=cms`
Manual (dev server): halaman apps dan roles menampilkan tabel, empty state saat kosong, tanpa regression filter.

- [ ] **Step 3: Commit**

Commit: `refactor(cms): DataTable untuk daftar aplikasi dan role`

### Task 4: Migrasi `notifications` + bersihkan slate

**Files:**
- Modify: `apps/cms/app/(shell)/[appSlug]/notifications/page.tsx`

- [ ] **Step 1: Ganti tabel + pagination manual dengan `DataTable`**

Kolom dari markup halaman; prop `pagination={{ pageIndex: page - 1, pageSize: PER_PAGE, totalRows: total, onPageChange: (i) => setPage(i + 1) }}`. Logika `useBoundedPage`, filter, reset halaman tidak diubah. Hapus markup `from`/`to` manual, ganti dengan `Pagination` bawaan `DataTable`.

- [ ] **Step 2: Bersihkan kelas slate di halaman ini (30 kemunculan)**

Ganti `slate-*` dengan token semantik atau primitif (`Input`, `Button`, `Select`); label teks tidak berubah.

- [ ] **Step 3: Verifikasi**

Run: `bunx turbo run typecheck lint --filter=cms`; `grep -c 'slate-' "app/(shell)/[appSlug]/notifications/page.tsx"` → 0.
Manual: filter + pindah halaman bekerja; reset ke halaman 1 saat filter baru.

- [ ] **Step 4: Commit**

Commit: `refactor(cms): DataTable dan token untuk halaman notifikasi`

### Task 5: Migrasi `cbt/soal` + bersihkan slate

**Files:**
- Modify: `apps/cms/app/(shell)/[appSlug]/cbt/soal/page.tsx`

- [ ] **Step 1: Ganti tabel + pagination dengan `DataTable`**

Sama pola dengan Task 4. Kolom soal (pertanyaan, kategori, aksi Ubah/Hapus bila ada) disalin utuh; form dan dialog soal tidak disentuh. Tombol `Tambah soal` dan label form (`Pertanyaan (wajib)` dst.) tidak berubah.

- [ ] **Step 2: Bersihkan kelas slate di halaman ini (19 kemunculan)** → token/primitif.

- [ ] **Step 3: Verifikasi**

`bunx turbo run typecheck lint --filter=cms`; `grep -c 'slate-' .../soal/page.tsx` → 0. E2e `production-readiness` (alur tambah soal) lulus di Task 10.

- [ ] **Step 4: Commit** — `refactor(cms): DataTable dan token untuk bank soal`

### Task 6: Migrasi `cbt/paket` + bersihkan slate

**Files:**
- Modify: `apps/cms/app/(shell)/[appSlug]/cbt/paket/page.tsx`

- [ ] **Step 1: Ganti tabel dengan `DataTable`**

Kolom aksi wajib utuh: `Komposisi`, `Aktifkan`/`Nonaktifkan` tetap `role="button"` di dalam sel baris (e2e memakai `getByRole("row", ...).getByRole("button", ...)`). Dialog komposisi (checkbox soal, `Simpan komposisi`) tidak disentuh.

- [ ] **Step 2: Bersihkan kelas slate di halaman ini (34 kemunculan)** → token/primitif.

- [ ] **Step 3: Verifikasi** — `bunx turbo run typecheck lint --filter=cms`; grep slate → 0.

- [ ] **Step 4: Commit** — `refactor(cms): DataTable dan token untuk paket CBT`

### Task 7: Migrasi `cbt/sesi` + bersihkan slate

**Files:**
- Modify: `apps/cms/app/(shell)/[appSlug]/cbt/sesi/page.tsx`

- [ ] **Step 1: Ganti tabel dengan `DataTable`**

Kolom sesi + aksi disalin utuh; panel simulasi (`Mulai simulasi`, `Mulai sesi`, radio, combobox `Paket aktif (wajib)`) tidak disentuh.

- [ ] **Step 2: Bersihkan slate (35 kemunculan)** → token/primitif.

- [ ] **Step 3: Verifikasi** — typecheck/lint; grep slate → 0.

- [ ] **Step 4: Commit** — `refactor(cms): DataTable dan token untuk sesi CBT`

### Task 8: Migrasi `cbt/hasil` + bersihkan slate

**Files:**
- Modify: `apps/cms/app/(shell)/[appSlug]/cbt/hasil/page.tsx`

- [ ] **Step 1: Ganti tabel dengan `DataTable`**

Kolom hasil + tombol ekspor hasil tetap; filter tetap di `TableToolbar`.

- [ ] **Step 2: Bersihkan slate (32 kemunculan)** → token/primitif.

- [ ] **Step 3: Verifikasi** — typecheck/lint; grep slate → 0.

- [ ] **Step 4: Commit** — `refactor(cms): DataTable dan token untuk hasil CBT`

### Task 9: Pembersihan slate sisa (form, detail, 403, media, settings, audit)

**Files:**
- Modify: `apps/cms/app/(shell)/[appSlug]/users/page.tsx` (7), `app/(shell)/[appSlug]/layout.tsx` (5), `app/(shell)/403/page.tsx` (2), `app/(shell)/[appSlug]/media/page.tsx` (13), `app/(shell)/[appSlug]/settings/page.tsx` (28), `app/(shell)/platform/admins/[id]/page.tsx` (15), `platform/admins/new/page.tsx` (3), `platform/apps/new/page.tsx` (6), `platform/apps/[slug]/page.tsx` (14), `platform/audit/page.tsx` (3), `platform/roles/[id]/page.tsx` (9), `platform/roles/new/page.tsx` (13), `features/exports/components/export-button.tsx` (1)

- [ ] **Step 1: Ganti semua `slate-*` dengan token/primitif per file**

Aturan: kontrol input memakai `Input`/`Select`, tombol memakai `Button`/`ButtonLink` (pertahankan `min-h-11`), teks status memakai `text-muted-foreground`/`text-destructive`, wadah `border-border bg-card`. `[appSlug]/layout.tsx` (403 inline) memakai `PageHeader`-style token + `ButtonLink` untuk "Kembali ke pemilih aplikasi" dengan teks yang sama. Label dan alur mutasi tidak berubah.

- [ ] **Step 2: Verifikasi nol slate**

Run: `grep -rn 'slate-\|--slate' apps/cms/app apps/cms/features apps/cms/components/shared | grep -v translate` → kosong.
Run: `bunx turbo run typecheck lint --filter=cms` → PASS.

- [ ] **Step 3: Commit** — `refactor(cms): kelas mentah slate diganti token tema di seluruh halaman`

### Task 10: Verifikasi akhir dan Delivery Gate

**Files:**
- Modify: `refactor-design/implementasi-saat-ini.md` (catat kondisi pascaredesign)

- [ ] **Step 1: Build + typecheck + lint penuh**

Run: `bunx turbo run typecheck lint --filter=cms && bun run build` (di `apps/cms`: `bun run build`)
Expected: PASS tanpa error.

- [ ] **Step 2: E2e penuh (DB fixture disposabel per README)**

Run sesuai `apps/cms/e2e/README.md`.
Expected: `app-context`, `design-refactor`, `production-readiness` lulus; screenshot mobile tercetak.

- [ ] **Step 3: Kontras + keyboard + mobile**

1. `python3 .agents/skills/antislop-human/contrast-check.py` untuk pasangan baru (chip inisial `text-muted-foreground` di `bg-muted`; teks di header `bg-card`) → AA.
2. Keyboard: tab order, Escape drawer, Ctrl+B, skip link.
3. Viewport 320/375px: tanpa scroll horizontal; target sentuh >= 44px.
4. Delivery Gate antislop (Hard Gate + Purpose-Gate + Liveliness + Quality Locks) dijalankan; temuan diperbaiki sebelum penyerahan.

- [ ] **Step 4: Perbarui dokumen baseline + commit**

Tambahkan bagian "kondisi pascaredesign" singkat di `refactor-design/implementasi-saat-ini.md`.
Commit: `docs(refactor-design): catat kondisi pascaredesign shell CMS`
