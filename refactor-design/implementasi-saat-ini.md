# Peta implementasi UI saat ini (baseline sebelum redesign)

Dokumen ini memetakan **kondisi nyata** di `apps/cms` pada branch `main-features` (per 2026-11-28), bukan rencana. Tujuannya menjadi baseline agar pekerjaan redesign tahu apa yang sudah ada, di mana lokasinya, dan celah mana yang perlu diseragamkan. Dokumen [peta-komponen.md](peta-komponen.md) masih berisi beberapa pernyataan kedaluwarsa (misalnya "shadcn/ui belum diinisialisasi"); bagian yang sudah berubah ditandai di sini.

## 1. Kerangka aplikasi dan rute

| Lapisan | File | Peran |
| --- | --- | --- |
| Root layout | `apps/cms/app/layout.tsx` | `<html lang="id">`, `font-sans`, memuat `app/globals.css`, metadata "CMS Platform" |
| Token tema | `apps/cms/app/globals.css` | Lihat bagian 2 |
| Konfigurasi shadcn | `apps/cms/components.json` | style `base-nova`, baseColor `neutral`, cssVariables aktif, icon library `lucide`, alias `@/components/ui` |
| Proteksi rute | `apps/cms/proxy.ts` | Redirect ke `/login` bila tanpa cookie sesi better-auth (`better-auth.session_token` / `__Secure-…`); path publik: `/login`, `/forgot-password`, `/reset-password`; `/` dibiarkan publik |
| Shell | `apps/cms/app/(shell)/layout.tsx` | `ApolloProvider` + `CmsSession` (memuat admin, apps, permissions ke Zustand store) + `SidebarProvider` + skip link "Lewati ke konten" + `CmsSidebar` + `ShellHeader` + konten di `#cms-content` + `Toaster` |
| Konteks aplikasi | `apps/cms/app/(shell)/[appSlug]/layout.tsx` | Validasi slug terhadap `accessibleApps`; slug tak dikenal dirender 403 inline (tanpa mengubah store); slug valid mengisi `activeSlug` |
| Halaman 403 | `apps/cms/app/(shell)/403/page.tsx` | Halaman 403 statis |
| Publik | `apps/cms/app/(public)/layout.tsx` + `page.tsx` | Landing: `max-w-6xl min-h-svh`, `PublicHeader` + konten + `PublicFooter` |
| Auth | `apps/cms/app/(auth)/` | login, forgot-password, reset-password tanpa shell |

Struktur `app/`: `(public)` landing di `/`, `(auth)` halaman masuk, `(shell)` berisi `platform/` (global) dan `[appSlug]/` (konteks aplikasi). Slug aplikasi menjadi bagian dari URL.

## 2. Tema dan token warna (`app/globals.css`)

- Tailwind v4: `@import "tailwindcss"`, `tw-animate-css`, `shadcn/tailwind.css`. Varian dark via `@custom-variant dark`.
- `@theme inline` memetakan variabel CSS ke utility: `--color-primary`, `--color-sidebar*`, `--radius-*` (skala sm sampai 4xl dari `--radius`).
- Base layer: `cursor: pointer` untuk `a[href]`, `button`, `select`, `label[for]`; disabled memakai `cursor: not-allowed`; `focus-visible` memakai outline 2px `--ring`; semua elemen memakai `border-border` dan `outline-ring/50`; `prefers-reduced-motion` mematikan animasi sidebar, dialog, sheet, dan select.
- Tema light (`:root`): background `#f7f9f8`, foreground `#182824`, **primary teal `#0c6156`**, ring `#216c61`, accent `#e0efea`, muted `#edf2ef`, border `#d5e0da`, destructive `#a52d30`, sidebar `#eff4f1`, radius `0.625rem`.
- Tema dark (`.dark`): masih default oklch dari shadcn (belum disesuaikan dengan brand teal). Catatan untuk redesign: dark mode ada variabelnya, tetapi belum diuji sebagai tema aktif produk.

## 3. Navbar / header CMS (`ShellHeader`)

File: `apps/cms/components/shared/shell-header.tsx`.

- `<header>` dengan grid: `grid-cols-[auto_minmax(0,1fr)_auto]` di mobile (app switcher turun ke baris 2), `sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]` di layar lebar. `border-b border-border bg-card px-4 py-2.5 sm:px-6`.
- Kolom 1: `SidebarTrigger` dari `components/ui/sidebar.tsx` (`size-11`, `aria-label="Menu utama"`, `aria-expanded` mengikuti state sidebar/mobile).
- Kolom 2: link brand "CMS Platform" ke `/platform/pilih-aplikasi` (`text-sm font-semibold tracking-tight`, `min-h-11`).
- Kolom 3: `AppSwitcher`.
- Kolom 4: `DropdownMenu` tombol "Akun" (`variant="outline"`) berisi label email admin, item `Ubah kata sandi` (link ke `/profile/change-password`), dan `Keluar` (signOut better-auth, reset store, push `/login`).
- `AppSwitcher` (`components/shared/app-switcher.tsx`): `Select` dari `components/ui/select` dengan nilai `activeSlug` atau `__all` ("Semua aplikasi"); saat berubah, `setActiveSlug` + `router.push` ke `/{slug}` atau `/platform/pilih-aplikasi`. `SelectTrigger` punya `aria-label="Pilih aplikasi"`, `max-w-52 bg-card min-h-11`.

Header publik (landing) ada di tempat berbeda: `features/landing/components/public-chrome.tsx` → `PublicHeader` (brand dengan bar `bg-primary` + nav berisi `ButtonLink` "Masuk CMS" ke `/login`) dan `PublicFooter` (identitas produk). Ini sengaja terpisah dari `ShellHeader`.

## 4. Sidebar

Fondasi: `apps/cms/components/ui/sidebar.tsx` (730 baris, shadcn base-nova dengan Base UI `useRender`).

- `SidebarProvider`: state open/closed, persist via cookie `sidebar_state` (max-age 7 hari), shortcut keyboard Ctrl/Cmd+B, dan `useIsMobile()` dari `hooks/use-mobile.ts` (breakpoint 768px).
- `Sidebar` default: `side="left"`, `variant="sidebar"`, `collapsible="offcanvas"`, lebar 16rem (mobile 18rem, mode icon 3rem). Saat mobile, sidebar dirender sebagai `Sheet` (drawer) dengan judul sr-only (`mobileTitle`, `mobileDescription`) dan `finalFocus` kembali ke trigger.
- Ekspor primitif: `SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`, `SidebarHeader`, `SidebarFooter`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarMenuSub*`, `useSidebar`.
- `SidebarMenuButton` menerima `render` (mis. `<Link href>`), `isActive`, `tooltip` (muncul saat collapsed), `variant`, dan `size`.

Komponen produk: `components/shared/sidebar.tsx` → `CmsSidebar`.

- `SidebarHeader`: link "Pilih aplikasi" (dengan bar `h-4 w-1 bg-primary`) ke picker; di mobile ada tombol "Tutup menu". `border-b border-sidebar-border`.
- `SidebarContent` berisi `<nav aria-label="Menu utama">` dengan dua `SidebarGroup`: grup "Platform" (`GLOBAL_MENU`) dan grup berlabel nama aplikasi aktif (`appMenu(slug, modules)`).
- `MenuList` (lokal di file itu): memetakan item ke `SidebarMenuItem` + `SidebarMenuButton` dengan `render={<Link href>}`, `isActive` (exact match, atau prefix kecuali key `dashboard`), `aria-current="page"` saat exact, `min-h-11 rounded-md`, dan `onClick` menutup menu mobile.
- Sumber menu dan aturan tampil: `features/shell/menu.ts`. `GLOBAL_MENU`: Dasbor, Aplikasi, Admin, Role, Audit Log (masing-masing `requires: platform.*.view`). `appMenu(slug, modules)`: Dasbor, Pengguna, Media, Notifikasi, Pengaturan, plus 4 item CBT (Soal, Paket, Sesi, Hasil) bila `modules` memuat `cbt`. `isVisible`: super admin lolos semua, selain itu wajib punya permission; penyaringan juga memperhitungkan `permissionsContext` dari `useSessionStore`.

## 5. Pola halaman, state, dan kontrol bersama (`components/shared/`)

| Komponen | File | Perilaku saat ini |
| --- | --- | --- |
| `PageHeader` | `page-header.tsx` | `header` flex wrap justify-between `border-b border-border pb-4`; `h1 text-2xl font-semibold tracking-tight`; deskripsi `text-sm text-muted-foreground`; slot `actions` di kanan. Dipakai hampir semua halaman shell. |
| `LoadingState` / `EmptyState` / `ErrorState` | `page-state.tsx` | Loading: `<p role="status">` teks muted. Empty: kotak `rounded-lg border bg-card px-4 py-6`. Error: `Alert variant="destructive"` + `AlertTitle` + opsional tombol "Coba lagi". |
| `TableToolbar` | `table-toolbar.tsx` | `<form>` `my-4 flex flex-wrap items-end gap-2`; di dalamnya filter (label + input/select) dan tombol. |
| `Pagination` | `pagination.tsx` | `<nav aria-label="Halaman hasil">`; tombol "Sebelumnya"/"Berikutnya" (disabled di ujung); teks rentang `x–y dari z` dengan `tabular-nums` dan `aria-live="polite"`; disembunyikan saat `totalRows === 0`. |
| `StatusBadge` | `status-badge.tsx` | `Badge variant="outline"` + peta tone: neutral, success (emerald), warning (amber), danger (red), info (teal). Teks label selalu tampil (tidak bergantung pada warna). `AppStatusBadge` di `features/apps/components/app-status-badge.tsx` memakainya untuk status aplikasi. |
| `ButtonLink` | `button-link.tsx` | `Link` + `buttonVariants({ variant })` + `min-h-11`. |
| `Toaster` | `toaster.tsx` | Fixed `top-4` kanan, `max-w-80`, daftar toast dari `useToastStore` (Zustand), auto-dismiss 6 detik, `role="status"`, tombol "Tutup" per toast. |
| `DataTable` | `data-table.tsx` | Lihat bagian 6. |
| `MediaPicker` | `media-picker.tsx` | Dialog pilih media lintas fitur. |

Pola wadah halaman: `<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">` (picker memakai `max-w-4xl`, state sesi `max-w-xl`). `PermissionGate` (`features/rbac/components/permission-gate.tsx`) membungkus aksi per permission.

## 6. Tabel data: dua pola yang berjalan bersamaan

**Pola A, `DataTable`** (`components/shared/data-table.tsx`), dipakai 3 halaman: `platform/admins`, `platform/audit`, `[appSlug]/users`.

- Memakai TanStack Table: `useReactTable` dengan `getCoreRowModel`, `manualPagination` saat `pagination` ada, `rowCount` dari total.
- Merender `Table` dari `components/ui/table` dengan `scrollLabel` (region scrollable dengan `aria-label` dan `tabIndex={0}`), header `bg-muted`, sel `px-3`, `EmptyState` bila `rows` kosong, dan `Pagination` opsional di bawah tabel.
- Pemanggil menyuplai `columns: ColumnDef<T>[]` (mis. kolom aksi dengan tombol Ubah/Nonaktifkan di `users/page.tsx`), `getRowId`, `label`, dan `emptyMessage`.

**Pola B, tabel mentah** (`components/ui/table` langsung), dipakai 7 halaman: `platform/apps`, `platform/roles`, `[appSlug]/notifications`, dan `cbt/soal`, `cbt/paket`, `cbt/sesi`, `cbt/hasil`. Header dan kolom ditulis inline di halaman; `className="min-w-max bg-card"` agar tabel scroll horizontal di layar sempit.

`components/ui/table.tsx`: `Table` membungkus `div` `overflow-x-auto rounded-lg border border-border` (menjadi `role="region"` bila `scrollLabel` diisi); `TableRow` punya `hover:bg-muted/50`; `TableHead` `h-10 px-2`; `TableCell` `p-2 whitespace-nowrap`.

**Catatan celah:** beberapa halaman (mis. `[appSlug]/users/page.tsx` bagian form/filter, dan pesan 403 di `[appSlug]/layout.tsx`) masih memakai kelas mentah seperti `text-slate-900`, `bg-slate-900`, `border-slate-300`, bukan token atau primitif `Input`/`Button`. Ini belum seragam.

## 7. Dashboard

Komponen bersama: `features/dashboard/components/dashboard-sections.tsx`.

- `DashboardSection`: `<section aria-labelledby>` `mt-7` dengan `h2 text-base font-semibold tracking-tight`.
- `MetricCard`: `Card` `py-3`; `dt` label `text-sm text-muted-foreground`, `dd` nilai `text-xl font-semibold tabular-nums`, hint `text-xs`. Nilai diformat dengan `formatCount` dari `lib/format-display`.
- `Metrics`: `<dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">` berisi `MetricCard`.
- `QueueSummary` (dasbor platform): 3 metrik antrean notifikasi (Terjadwal, Mengirim, Gagal).
- `PlatformAppCard`: `Card` berisi nama, `AppStatusBadge`, slug, serta `dl` (Pengguna, Aktivitas 7 hari) dengan `border-t`.
- `CampaignSummary` (dasbor aplikasi): 4 metrik (Draf, Terjadwal, Terkirim, Gagal).
- `ModuleMetricList`: metrik dari `sections[]` API; `EmptyState` bila kosong.
- `ActivityList`: `<ul className="divide-y divide-border rounded-lg border bg-card">`; tiap item berisi ringkasan aktivitas + meta (admin, aplikasi, waktu via `formatDateTime`).

Pemakaian:

- `app/(shell)/platform/dashboard/page.tsx`: `PageHeader` + `QueueSummary` + grid kartu aplikasi (`sm:grid-cols-2 xl:grid-cols-3`) + `ActivityList`; state: tanpa izin → `EmptyState`, loading, error dengan `refetch`.
- `app/(shell)/[appSlug]/page.tsx`: `PageHeader` dengan `AppStatusBadge` sebagai `actions`, lalu `ModuleMetricList`, `CampaignSummary`, `ActivityList`.

## 8. Landing publik

- `app/(public)/page.tsx`: grid dua kolom (`md:grid-cols-[1.15fr_0.85fr]`) berisi `LandingHero` dan `ProductExplanation`.
- `features/landing/components/landing-sections.tsx`: `LandingHero` = `h1` besar `text-balance` ("Kelola banyak aplikasi dari satu CMS"), subjudul, `ButtonLink` "Masuk CMS"; `ProductExplanation` = kartu berborder dengan `dl` tiga alur kerja (Aplikasi dan akses, Media dan notifikasi, Modul CBT).

## 9. Celah yang relevan untuk redesign (ringkasan)

1. shadcn/ui sudah terpasang penuh (21 primitif di `components/ui/`), style `base-nova` dengan Base UI; `peta-komponen.md` lama yang masih bilang "belum diinisialisasi" sudah kedaluwarsa.
2. Sidebar sudah memakai primitif shadcn apa adanya (provider, cookie, drawer mobile via Sheet, shortcut Ctrl+B, tooltip saat collapsed). Header masih grid custom dan app switcher masih `Select`.
3. `DataTable` baru dipakai 3 dari 10 halaman bertabel; 7 halaman masih tabel mentah tanpa `EmptyState`/pagination terpadu. Ini kandidat utama penyeragaman.
4. Masih ada kelas mentah (slate) di beberapa halaman, sehingga belum 100% token tema.
5. Tema `.dark` masih default shadcn; light sudah brand teal (`#0c6156`).
6. Aksesibilitas yang sudah berjalan: skip link, `aria-current` menu aktif, `aria-label` region tabel/pagination/switcher, `role="status"` loading/toast, fokus visible via `--ring`, reduced-motion, target sentuh `min-h-11` (44px) pada kontrol utama.

## 10. Daftar file acuan cepat

| Kebutuhan | File |
| --- | --- |
| Tema/token | `apps/cms/app/globals.css`, `apps/cms/components.json` |
| Shell + sesi | `apps/cms/app/(shell)/layout.tsx`, `apps/cms/stores/use-session-store.ts`, `apps/cms/stores/use-toast-store.ts` |
| Header/navbar | `apps/cms/components/shared/shell-header.tsx`, `app-switcher.tsx` |
| Sidebar | `apps/cms/components/shared/sidebar.tsx`, `apps/cms/components/ui/sidebar.tsx`, `apps/cms/features/shell/menu.ts`, `apps/cms/features/shell/routes.ts` |
| Halaman umum | `apps/cms/components/shared/page-header.tsx`, `page-state.tsx`, `table-toolbar.tsx`, `pagination.tsx`, `status-badge.tsx`, `button-link.tsx`, `toaster.tsx` |
| Tabel | `apps/cms/components/shared/data-table.tsx`, `apps/cms/components/ui/table.tsx`, contoh pemai: `app/(shell)/[appSlug]/users/page.tsx` (DataTable) dan `app/(shell)/platform/apps/page.tsx` (tabel mentah) |
| Dashboard | `apps/cms/features/dashboard/components/dashboard-sections.tsx`, `app/(shell)/platform/dashboard/page.tsx`, `app/(shell)/[appSlug]/page.tsx` |
| Landing | `apps/cms/app/(public)/`, `apps/cms/features/landing/components/` |
| Konteks aplikasi/403 | `apps/cms/app/(shell)/[appSlug]/layout.tsx` |
| Proteksi rute | `apps/cms/proxy.ts` |
