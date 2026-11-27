# Rencana Implementasi F14: UI CMS Menu Mobile

Tanggal: 2026-11-28. Cabang: `main-features`.
Spec: [F14: Manajemen Menu Mobile per Aplikasi](../../../features/F14-manajemen-menu-mobile.md).
Backend tahap pertama sudah selesai (commit `8d31a56`, `0ae5441`, `45c48cd`, `b12cd0d`): query `mobileMenus` dan mutation `createMobileMenu`/`updateMobileMenu`/`deleteMobileMenu`, app-scoped via `X-App-Slug`, permission `platform.mobile-menus.view/create/update/delete`, audit log.

## Batas global

- Halaman baru pada konteks aplikasi: `/{appSlug}/menu-mobile`. Sidebar CMS lainnya tidak berubah (F14 melarang mengubah item sidebar CMS lain).
- Tombol dipetakan ke permission yang sama dengan mutation API: buka/baca `.view`, tambah `.create`, simpan/urutkan/aktif-nonaktif `.update`, hapus `.delete`. Super Admin bypass via pola gating yang ada.
- `routeKey`/`iconKey` pada tahap ini identifier bebas format `^[a-z][a-z0-9._-]{0,254}$` (manifest F13 belum ada); UI memberi validasi format ringan di sisi klien dan menampilkan pesan error API apa adanya. Jangan tawarkan URL/path.
- Form memakai primitif shadcn yang sudah terpasang (`Field`, `FieldGroup`, `Input`, `Select`, `Card`, `Button`, `Badge`); state halaman memakai `LoadingState`/`EmptyState`/`ErrorState` dari `components/shared/page-state`; status memakai `StatusBadge`.
- Error validasi API ditampilkan dan input tidak di-reset bila gagal (pola `PackageForm`).
- Tidak ada tabel `role-menu` baru; permission form Role tetap lewat `role_permissions` F05.
- Verifikasi: `bunx turbo run typecheck lint --filter=cms`, `bun test lib components` (tambah unit test untuk helper pohon menu). E2e milik tester.

## Task 1: Item menu sidebar + rute

- `features/shell/menu.ts`: item `menu-mobile` (label "Menu Mobile", ikon lucide `ListTree`, href `/{slug}/menu-mobile`, requires `platform.mobile-menus.view`) diletakkan setelah Notifikasi.
- Breadcrumb otomatis mengikuti `appMenu`; tidak perlu peta statis baru.

## Task 2: Modul GraphQL + halaman Menu Mobile

- `features/mobile-menus/graphql/mobile-menus.graphql.ts`: dokumen `MOBILE_MENUS_QUERY`, `CREATE_MOBILE_MENU_MUTATION`, `UPDATE_MOBILE_MENU_MUTATION`, `DELETE_MOBILE_MENU_MUTATION` + tipe `MobileMenuData` (id, appId, name, slug, routeKey, iconKey, parentId, orderNo, isActive, createdAt, updatedAt), pola `cbt.graphql.ts`.
- Helper pohon murni `buildMenuTree(rows)`: kelompokkan per `parentId`, urutkan sibling per `orderNo` lalu `id`; unit test di `features/mobile-menus/menu-tree.test.ts` (kasus: kosong, dua tingkat, urutan seri, orphan parent hilang tidak terjadi karena API menjamin parent sama app).
- Halaman `app/(shell)/[appSlug]/menu-mobile/page.tsx`:
  - Gating `canView`/`canCreate`/`canUpdate`/`canDelete` pola halaman lain; tanpa `.view` tampil `EmptyState` penolak.
  - `PageHeader` judul "Menu Mobile" (nama aksesibel heading halaman).
  - Pohon: `Card` berisi daftar bersarang; tiap baris memperlihatkan nama, slug (muted), `Badge` routeKey/iconKey bila ada, `StatusBadge` aktif, dan aksi: "Ubah" (`.update`), "Naik"/"Turun" tukar `orderNo` dengan sibling (`.update`), "Aktifkan/Nonaktifkan" (`.update`, konfirmasi), "Tambah sub" (`.create`, form dengan parent terpasang), "Hapus" (`.delete`, konfirmasi; error API "masih punya anak" ditampilkan apa adanya).
  - Form buat/ubah dalam `Card` dengan `FieldGroup`/`Field`: Nama (wajib), Slug (wajib, format kebab), Parent (`Select` opsional; saat mengubah, diri dan keturunannya tidak ditawarkan), Route key (opsional), Icon key (opsional), Urutan (angka >= 0), Aktif (checkbox). Validasi format ringan klien; error API via `graphQLErrorMessage`, state tetap terisi.
  - State halaman pola `cbt/paket`: status sukses/gagal, loading, error dengan retry, empty tree.

## Task 3: Grup permission Menu Mobile di form Role

- `platform/roles/new/page.tsx` dan `platform/roles/[id]/page.tsx`: dalam grup module `platform`, empat permission `platform.mobile-menus.*` dirender di bawah sub-keterangan "Menu Mobile" (konstanta prefiks di satu tempat per file; tanpa perubahan kontrak API).
- Tanpa perubahan penyimpanan: tetap `role_permissions`.

## Task 4: Dokumen + verifikasi akhir

- Tandai checkbox tahap CMS UI di `features/F14-manajemen-menu-mobile.md` yang benar-benar selesai; tulis catatan UI tahap identifier (manifest F13 belum).
- Jalankan typecheck, lint, unit test; commit.
