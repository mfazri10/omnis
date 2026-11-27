# Peta implementasi UI CMS (kondisi pascaredesign 2026-11-28)

Dokumen ini memetakan **kondisi nyata** di `apps/cms` pada branch `main-features` setelah redesign UI (pendekatan C hybrid, spec `docs/superpowers/specs/2026-11-28-cms-ui-redesign-design.md`) selesai dikerjakan. Baseline pra-redesign ada di riwayat git dokumen ini. Dokumen [peta-komponen.md](peta-komponen.md) masih berisi beberapa pernyataan kedaluwarsa (misalnya "shadcn/ui belum diinisialisasi").

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

- `<header className="sticky top-0 z-50 border-b border-border bg-card">`; baris tunggal `flex min-h-11 items-center gap-2 px-4 py-2 sm:px-6` (pola site-header `sidebar-16`). Sticky dipilih karena halaman tabel panjang.
- Kolom 1: `SidebarTrigger` (`size-11`, `aria-label="Menu utama"`, `aria-expanded` mengikuti state sidebar/mobile).
- Kolom 2: `Separator` vertikal, lalu `Breadcrumbs` di dalam `div hidden sm:flex` (breadcrumb disembunyikan di layar < `sm`).
- Kolom 3: spacer `flex-1`, lalu `AppSwitcher` di ujung kanan. Menu akun tidak lagi di header (pindah ke footer sidebar).
- `#cms-content` diberi `scroll-mt-20` agar anchor/skip link tidak tertutup header sticky.

`Breadcrumbs` (`components/shared/breadcrumbs.tsx`): dua tingkat, konteks (Platform/nama aplikasi, link ke picker atau `/{slug}`) dan halaman (label item menu aktif dicocokkan dari `usePathname` terhadap `GLOBAL_MENU`/`appMenu`; halaman tanpa item menu memakai peta label statis/prefiks detail dinamis). `buildBreadcrumb(pathname, apps)` menerima `modules` per aplikasi dan diuji unit di `breadcrumbs.test.ts` (11 test). Primitif `components/ui/breadcrumb.tsx` ditambahkan via `bunx shadcn add breadcrumb`.

- `AppSwitcher` (`components/shared/app-switcher.tsx`): `Select` dari `components/ui/select` dengan nilai `activeSlug` atau `__all` ("Semua aplikasi"); saat berubah, `setActiveSlug` + `router.push` ke `/{slug}` atau `/platform/pilih-aplikasi`. `SelectTrigger` punya `aria-label="Pilih aplikasi"`, `max-w-52 bg-card min-h-11`.

Header publik (landing) ada di tempat berbeda: `features/landing/components/public-chrome.tsx` → `PublicHeader` (brand dengan bar `bg-primary` + nav berisi `ButtonLink` "Masuk CMS" ke `/login`) dan `PublicFooter` (identitas produk). Ini sengaja terpisah dari `ShellHeader`.

## 4. Sidebar

Fondasi: `apps/cms/components/ui/sidebar.tsx` (730 baris, shadcn base-nova dengan Base UI `useRender`).

- `SidebarProvider`: state open/closed, persist via cookie `sidebar_state` (max-age 7 hari), shortcut keyboard Ctrl/Cmd+B, dan `useIsMobile()` dari `hooks/use-mobile.ts` (breakpoint 768px).
- `Sidebar` default: `side="left"`, `variant="sidebar"`, `collapsible="offcanvas"`, lebar 16rem (mobile 18rem, mode icon 3rem). Saat mobile, sidebar dirender sebagai `Sheet` (drawer) dengan judul sr-only (`mobileTitle`, `mobileDescription`) dan `finalFocus` kembali ke trigger.
- Ekspor primitif: `SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`, `SidebarHeader`, `SidebarFooter`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarMenuSub*`, `useSidebar`.
- `SidebarMenuButton` menerima `render` (mis. `<Link href>`), `isActive`, `tooltip` (muncul saat collapsed), `variant`, dan `size`.

Komponen produk: `components/shared/sidebar.tsx` → `CmsSidebar`.

- `SidebarHeader`: link brand "CMS Platform" (dengan bar `h-4 w-1 bg-primary`) ke `/platform/pilih-aplikasi`; di mobile ada tombol "Tutup menu". `border-b border-sidebar-border`. Fungsi "pilih aplikasi" dicakup `AppSwitcher` dan breadcrumb, jadi link lama diganti identitas produk.
- `SidebarContent` berisi `<nav aria-label="Menu utama">` dengan dua `SidebarGroup`: grup "Platform" (`GLOBAL_MENU`) dan grup berlabel nama aplikasi aktif (`appMenu(slug, modules)`).
- `MenuList` (lokal di file itu): memetakan item ke `SidebarMenuItem` + `SidebarMenuButton` dengan `render={<Link href>}`, `isActive` (exact match, atau prefix kecuali key `dashboard`), `aria-current="page"` saat exact, `min-h-11 rounded-md`, ikon lucide per item (`aria-hidden`), dan `onClick` menutup menu mobile.
- Sumber menu dan aturan tampil: `features/shell/menu.ts`. Setiap `MenuItem` kini punya field `icon: LucideIcon` (Dasbor `LayoutDashboard`, Aplikasi `Smartphone`, Admin `UserCog`, Role `ShieldCheck`, Audit Log `ScrollText`, Pengguna `Users`, Media `Images`, Notifikasi `Bell`, Pengaturan `Settings`, Soal CBT `FileQuestion`, Paket CBT `Package`, Sesi CBT `CalendarClock`, Hasil CBT `ClipboardCheck`). `isVisible`: super admin lolos semua, selain itu wajib punya permission; penyaringan juga memperhitungkan `permissionsContext` dari `useSessionStore`.
- `SidebarFooter` baru berisi `NavUser` (`components/shared/nav-user.tsx`, pola nav-user `sidebar-16`): trigger `SidebarMenuButton size="lg"` dengan `aria-label="Akun"` (dikunci stabil, bukan email), avatar fallback inisial email, nama admin di atas email, chevron; dropdown berisi label identitas, `Ubah kata sandi` (link `/profile/change-password`), `Keluar` (signOut better-auth, reset store, push `/login`). Klik item menutup drawer mobile. Di mobile, footer ikut dirender di dalam drawer.
- `collapsible` tetap `offcanvas`; mode icon tidak diaktifkan. Cookie state `sidebar_state` dan shortcut Ctrl/Cmd+B tetap.

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


## 6. Tabel data: satu pola (`DataTable`)

`DataTable` (`components/shared/data-table.tsx`) kini menjadi satu-satunya pola tabel, dipakai seluruh 10 halaman daftar: `platform/admins`, `platform/apps`, `platform/roles`, `platform/audit`, `[appSlug]/users`, `[appSlug]/notifications`, dan `cbt/soal`, `cbt/paket`, `cbt/sesi`, `cbt/hasil`.

- Memakai TanStack Table: `useReactTable` dengan `getCoreRowModel`, `manualPagination` saat `pagination` ada, `rowCount` dari total.
- Merender `Table` dari `components/ui/table` dengan `scrollLabel` (region scrollable dengan `aria-label` dan `tabIndex={0}`), header `bg-muted`, sel `px-3`, `EmptyState` bila `rows` kosong, dan `Pagination` opsional di bawah tabel.
- Pemanggil menyuplai `columns: ColumnDef<T>[]`, `getRowId`, `label`, dan `emptyMessage`. Kolom aksi memakai `Button variant="link"` dengan `min-h-11`. Halaman tanpa pagination server (apps, roles) memakai `DataTable` tanpa prop `pagination`. Baris detail kampanye notifikasi (dulu baris expandable) menjadi Dialog "Detail" karena DataTable core tidak mendukung ekspansi baris dan API-nya tidak boleh berubah.

`components/ui/table.tsx`: `Table` membungkus `div` `overflow-x-auto rounded-lg border border-border` (menjadi `role="region"` bila `scrollLabel` diisi); `TableRow` punya `hover:bg-muted/50`; `TableHead` `h-10 px-2`; `TableCell` `p-2 whitespace-nowrap`. Baris tetap `role="row"` semantik sehingga selektor e2e `getByRole("row", ...)` bekerja.

Kelas mentah `slate-*`/`red-700`/`green-700` sudah nol di seluruh `app/`, `features/`, dan `components/shared/`; kontrol memakai primitif `Input`/`Button` atau konstanta bertoken (`CONTROL_CLASS`), state memakai `LoadingState`/`EmptyState`/`ErrorState`. Teks sukses memakai konvensi `text-emerald-700` (kelas palet mentah yang disetujui, sama dengan preseden tone success di `status-badge.tsx`; lulus AA di atas `bg-card`), teks gagal `text-destructive`.

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
- `features/landing/components/landing-sections.tsx`: `LandingHero` = `h1` besar `text-balance` ("Kelola banyak aplikasi dari satu CMS"), subjudul, `ButtonLink` "Masuk CMS"; `ProductExplanation` = kartu berborder dengan `dl` tiga alur kerja (Aplikasi dan akses, Media dan notifikasi, Modul CBT). Tidak diubah oleh redesign (sudut desainnya selesai lebih awal).

## 9. Status pascaredesign (ringkasan)

1. shadcn/ui terpasang penuh (22 primitif di `components/ui/`, termasuk `breadcrumb`), style `base-nova` dengan Base UI.
2. Shell memakai satu bahasa: header sticky dengan breadcrumb penanda lokasi + `AppSwitcher`, sidebar dengan ikon lucide per item dan menu akun `NavUser` di footer. Cookie state, shortcut Ctrl/Cmd+B, drawer mobile, dan fokus balik ke trigger tetap utuh.
3. `DataTable` dipakai seluruh 10 halaman daftar; tidak ada lagi tabel mentah inline.
4. Kelas mentah nol: seluruh halaman memakai token tema dan primitif; kontras pasangan teks/latar utama diverifikasi WCAG AA (foreground/card 15.35:1, muted-foreground/card 6.21:1, muted-foreground/muted 5.48:1, foreground/background 14.52:1, muted-foreground/background 5.87:1).
5. Tema `.dark` tetap default shadcn dan tidak diaktifkan (keputusan desain); light brand teal (`#0c6156`).
6. Aksesibilitas yang berjalan: skip link, `aria-current` menu aktif dan breadcrumb, `aria-label` region tabel/pagination/switcher, `role="status"` loading/toast, fokus visible via `--ring`, reduced-motion, target sentuh `min-h-11` (44px).
7. Nama aksesibel yang diikat e2e tidak berubah; satu pengecualian disanksikan spec: alur `production-readiness.test.ts` kini membuka drawer `Menu utama` dulu sebelum mengeklik `Akun` (lokasi baru menu akun di footer sidebar). E2e milik tester dan belum dijalankan pada pekerjaan ini.

## 10. Daftar file acuan cepat

| Kebutuhan | File |
| --- | --- |
| Tema/token | `apps/cms/app/globals.css`, `apps/cms/components.json` |
| Shell + sesi | `apps/cms/app/(shell)/layout.tsx`, `apps/cms/stores/use-session-store.ts`, `apps/cms/stores/use-toast-store.ts` |
| Header/navbar | `apps/cms/components/shared/shell-header.tsx`, `app-switcher.tsx`, `breadcrumbs.tsx` + `breadcrumbs.test.ts`, `apps/cms/components/ui/breadcrumb.tsx` |
| Sidebar | `apps/cms/components/shared/sidebar.tsx`, `nav-user.tsx`, `apps/cms/components/ui/sidebar.tsx`, `apps/cms/features/shell/menu.ts`, `apps/cms/features/shell/routes.ts` |
| Halaman umum | `apps/cms/components/shared/page-header.tsx`, `page-state.tsx`, `table-toolbar.tsx`, `pagination.tsx`, `status-badge.tsx`, `button-link.tsx`, `toaster.tsx` |
| Tabel | `apps/cms/components/shared/data-table.tsx`, `apps/cms/components/ui/table.tsx`, contoh pemakai lengkap: `app/(shell)/[appSlug]/notifications/page.tsx` (DataTable + Dialog detail) dan `app/(shell)/[appSlug]/cbt/sesi/page.tsx` (DataTable + panel form) |
| Dashboard | `apps/cms/features/dashboard/components/dashboard-sections.tsx`, `app/(shell)/platform/dashboard/page.tsx`, `app/(shell)/[appSlug]/page.tsx` |
| Landing | `apps/cms/app/(public)/`, `apps/cms/features/landing/components/` |
| Konteks aplikasi/403 | `apps/cms/app/(shell)/[appSlug]/layout.tsx` |
| Proteksi rute | `apps/cms/proxy.ts` |
