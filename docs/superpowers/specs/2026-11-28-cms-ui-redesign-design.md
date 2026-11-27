# Desain Redesign UI CMS (Pendekatan C: Hybrid)

Tanggal: 2026-11-28. Cabang kerja: `main-features`.
Baseline: [peta implementasi saat ini](../../../refactor-design/implementasi-saat-ini.md). Arah visual: [arah-visual.md](../../../refactor-design/arah-visual.md) (tenang, padat, aksen teal; ENERGY 1 / RHYTHM 2 / MOTION 1).

## 1. Intent dan alasan

CMS sudah memakai shadcn/ui (base-nova, Base UI) sejak commit `1cea89c`, tetapi adopsinya belum merata: sidebar sudah penuh primitif shadcn, sementara header masih grid custom tanpa penanda lokasi, tabel masih ada dua pola (3 halaman `DataTable`, 7 halaman tabel mentah), dan sebagian halaman masih memakai kelas mentah (`slate`). Redesign ini menyatukan shell dan pola halaman ke satu bahasa visual, tanpa menyentuh logika sesi, permission, dan GraphQL.

Siapa penggunanya: admin platform yang berpindah antar aplikasi dan mengerjakan tugas operasional berulang (tabel, form, dialog). Kegunaannya, bukan kebaruan, yang jadi ukuran.

## 2. Tujuan

1. Satu pola shell: header dengan breadcrumb (penanda lokasi "di aplikasi mana, di halaman apa"), sidebar dengan ikon per item dan menu akun di footer.
2. Satu pola tabel: seluruh halaman daftar memakai `DataTable` (toolbar, empty state, pagination bila ada).
3. Nol kelas mentah: semua halaman memakai token tema dan primitif `components/ui`.
4. Nama aksesibel dan perilaku keyboard yang sudah diuji e2e tetap utuh.

## 3. Non-goals

- Landing publik dan halaman auth (sudut desainnya selesai di commit `1cea89c`; tidak diubah).
- Chart di dashboard. API tidak menyediakan data deret waktu; chart tanpa data nyata dilarang (aturan R-17 antislop).
- Toggle dark mode. Produk admin dengan brand light teal; `.dark` dibiarkan sebagai variabel bawaan yang tidak diaktifkan (keputusan R-21: tema tetap dari identitas brand, bukan tren).
- Perubahan kontrak GraphQL, permission, provisioning, toast system, atau struktur rute.

## 4. Anti-goals

- Merusak drawer sidebar mobile, pintasan Ctrl/Cmd+B, cookie state sidebar, atau fokus yang kembali ke pemicu.
- Mengubah teks label yang dipakai e2e (lihat bagian 7).
- Menambah elemen dekoratif (glow, gradien, badge kosong, angka palsu).

## 5. Pendekatan yang dipertimbangkan

| Pendekatan | Isi | Alasan tidak dipilih |
| --- | --- | --- |
| A. Adopsi penuh blok shadcn | Meniru `sidebar-16`/`dashboard-01` apa adanya (`SidebarInset`, nav-user, site-header) | Migrasi besar berisiko merusak perilaku permission/sesi yang sudah benar; blok resmi memuat fitur yang tidak dipakai produk ini |
| B. Refinement in-place | Struktur tetap, hanya poles token dan seragamkan tabel | Tidak menjawab masalah utama shell: tidak ada penanda lokasi (breadcrumb) dan menu akun menempati header |
| C. Hybrid (dipilih) | Adopsi pola shell shadcn secara selektif, pertahankan logika produk | Perubahan terasa pada shell dan tabel, risiko terkendali karena hanya lapisan presentasi yang berubah |

Referensi resmi yang diambil via `bunx shadcn view`: `sidebar-16` (site-header + nav-user + nav-main), `sidebar-01` (versi-switcher, pola grup), `dashboard-01` (section-cards, data-table TanStack). Kode blok hanya pola acuan; implementasi memakai data dan aturan produk ini.

## 6. Keputusan desain

### 6.1 Shell layout

- `app/(shell)/layout.tsx`: wadah konten berganti dari `<div className="min-w-0 flex-1">` menjadi `SidebarInset` dari `components/ui/sidebar` (pola `sidebar-16`). `SidebarProvider` dan skip link tetap.
- Header (`components/shared/shell-header.tsx`) ditata ulang mengikuti pola site-header `sidebar-16`: `sticky top-0 z-50 border-b bg-card`, baris tunggal `SidebarTrigger` + `Separator` vertikal + breadcrumb; `AppSwitcher` di ujung kanan. Di layar < `sm`, breadcrumb disembunyikan dan baris cukup memuat trigger + switcher (switcher tetap terlihat karena e2e memakainya untuk berpindah konteks).
- Header sticky dipilih karena halaman tabel panjang: admin perlu akses navigasi tanpa scroll balik. Alasan elevasi: hanya header dan sidebar yang menempel; konten tetap datar (R-12).

### 6.2 Breadcrumb

- Komponen baru `components/shared/breadcrumbs.tsx`, memakai primitif `breadcrumb` (perlu ditambah via `bunx shadcn add breadcrumb`).
- Isi dua tingkat: (1) konteks: teks "Platform" untuk rute `/platform/*` atau nama aplikasi untuk `/[appSlug]/*`, link ke `/platform/pilih-aplikasi` atau `/{slug}`; (2) halaman: label item menu aktif yang dicocokkan dari `usePathname` terhadap `GLOBAL_MENU`/`appMenu`. Halaman tanpa item menu (mis. detail `[id]`) menampilkan label statis per halaman; pemetaan sederhana di file breadcrumbs, bukan query baru.
- Rute tanpa konteks aplikasi (mis. `/profile/change-password`): tingkat konteks tetap tampil sebagai "Platform" yang link ke pemilih. Khusus `/platform/pilih-aplikasi` sendiri, breadcrumb hanya menampilkan satu tingkat "Pilih aplikasi" (link konteks akan menduplikasi halaman itu sendiri).
- `aria-label="Breadcrumb"`, halaman aktif `aria-current="page"` (sudah dibawa primitif). Breadcrumb bukan pengganti `PageHeader`: judul H1 per halaman tetap.

### 6.3 Sidebar

- Struktur `CmsSidebar` tetap: grup "Platform" dan grup aplikasi aktif, penyaringan permission dan `permissionsContext` tidak berubah.
- Header sidebar berganti fungsi menjadi identitas produk: link "CMS Platform" (dengan bar teal, link ke `/platform/pilih-aplikasi`) menggantikan link "Pilih aplikasi". Fungsi "pilih aplikasi" sudah tercakup oleh `AppSwitcher` di header dan tingkat konteks breadcrumb, jadi tidak ada fungsi yang hilang. Tombol "Tutup menu" di mobile tetap. (Keputusan pemilik produk, 2026-11-28.)
- `MenuItem` di `features/shell/menu.ts` mendapat field `icon` berisi nama ikon lucide. Ikon dipilih dari makna tindakan (R-04), label tetap pembawa makna utama, ikon `aria-hidden`:

| Menu | Ikon | Alasan |
| --- | --- | --- |
| Dasbor | `LayoutDashboard` | panel ringkasan |
| Aplikasi | `Smartphone` | objek yang dikelola adalah aplikasi mobile |
| Admin | `UserCog` | pengaturan akun pengelola |
| Role | `ShieldCheck` | hak akses |
| Audit Log | `ScrollText` | riwayat catatan |
| Pengguna | `Users` | daftar orang |
| Media | `Images` | pustaka aset gambar |
| Notifikasi | `Bell` | kanal push |
| Pengaturan | `Settings` | konfigurasi |
| Soal CBT | `FileQuestion` | bank soal |
| Paket CBT | `Package` | paket ujian |
| Sesi CBT | `CalendarClock` | sesi terjadwal |
| Hasil CBT | `ClipboardCheck` | hasil pengerjaan |

Satu pustaka ikon (lucide) adalah keputusan proyek, bukan default: `components.json` mengunci `iconLibrary: lucide` dan `lucide-react` sudah menjadi dependensi.

- Footer baru `SidebarFooter` berisi `NavUser` (komponen baru `components/shared/nav-user.tsx`, pola nav-user `sidebar-16`): trigger `SidebarMenuButton size="lg"` dengan `aria-label="Akun"` berisi avatar fallback inisial email, email admin, dan chevron; dropdown berisi label email, `Ubah kata sandi` (link `/profile/change-password`), `Keluar` (signOut + reset + `/login`). Nama aksesibel trigger dikunci ke "Akun" (bukan email fixture) agar stabil lintas data uji. Tidak ada item menu kosong.
- Menu akun pindah dari header ke footer sidebar; header hanya menyisakan navigasi konteks. Di mobile drawer, footer ikut dirender di dalam drawer sehingga akun tetap terjangkau.
- `collapsible` tetap `offcanvas`; mode icon tidak diaktifkan (menu pendek, 5-9 item; mode icon menambah tooltip tanpa manfaat pada kepadatan ini). Cookie state dan shortcut Ctrl/Cmd+B tetap.

### 6.4 Tabel

- `DataTable` (`components/shared/data-table.tsx`) menjadi satu-satunya pola tabel. Tujuh halaman tabel mentah dimigrasi: `platform/apps`, `platform/roles`, `[appSlug]/notifications`, `[appSlug]/cbt/soal`, `cbt/paket`, `cbt/sesi`, `cbt/hasil`.
- Halaman tanpa pagination server (apps, roles, notifications jika demikian) memakai `DataTable` tanpa prop `pagination`; kolom, filter, dan aksi tetap milik halaman.
- `TableToolbar`, `Pagination`, `StatusBadge`, dan `EmptyState` tetap dipakai tanpa perubahan API.
- Baris tetap `role="row"` semantik lewat `ui/table` sehingga selektor e2e `getByRole("row", ...)` tetap berfungsi.

### 6.5 Pembersihan kelas mentah

- `[appSlug]/users/page.tsx`: form dan filter beralih dari kelas `slate` ke `Input`, `Button`, `Select`/native select bertoken; logika mutasi tidak berubah.
- `[appSlug]/layout.tsx` (403 inline): memakai `PageHeader`-style token, `ButtonLink` untuk "Kembali ke pemilih aplikasi", teks sama.
- Halaman 403 statis dan picker sudah bertoken; hanya dicek ulang konsistensinya.

### 6.6 Halaman dan state

- `PageHeader`, `page-state` (Loading/Empty/Error), `dashboard-sections` dipertahankan; `MetricCard` tetap karena datanya nyata dari API (`platformDashboard`/`appDashboard`), tanpa delta trend yang tidak ada sumbernya.
- Empty state tetap menyebut penyebab dan langkah berikutnya (pola saat ini sudah benar, dipertahankan).

## 7. Nama aksesibel yang tidak boleh berubah (diikat e2e)

`Menu utama` (nav), `Pilih aplikasi` (combobox) beserta opsi nama aplikasi, tautan menu `Soal CBT`/`Media`/`Admin`, heading halaman (`Bank soal`, `Perpustakaan media`, `Anda tidak memiliki akses`, nama aplikasi di dasbor), label form (`Pertanyaan (wajib)`, `Judul (wajib)`, `Kunci jawaban (wajib)`, `Opsi A-C (wajib)`, `Paket aktif (wajib)`), tombol (`Tambah soal`, `Tambah paket`, `Simpan`, `Simpan komposisi`, `Komposisi`, `Aktifkan`, `Nonaktifkan`, `Mulai simulasi`, `Mulai sesi`, `Pilih media`, `Masuk`), dan dialog `Pilih media` dengan `Cari media`.

Tombol `Akun` dipakai e2e: `production-readiness.test.ts:297` mengekliknya pada viewport 320px dengan drawer tertutup, lalu `Ubah kata sandi`. Karena menu akun pindah ke footer sidebar (di dalam drawer pada mobile), alur test itu diubah sebagai bagian pekerjaan ini: buka drawer lewat trigger `Menu utama` dulu, lalu klik `Akun`, lalu `Ubah kata sandi`. Nama aksesibel yang diuji tidak berubah; hanya jalur navigasi test yang menyesuaikan lokasi baru.

## 8. Yang diserahkan ke builder

- Urutan migrasi halaman tabel (disarankan: apps, roles, notifications, lalu cbt satu per satu; verifikasi tiap halaman sebelum lanjut).
- Detail kolom per tabel (mengikuti kolom yang sudah ada di halaman masing-masing, tanpa menambah kolom baru).
- Penyesuaian spacing minor dalam batas arah visual (padding halaman `px-4 py-6 sm:px-6` tetap acuan).
- Pemetaan breadcrumb untuk halaman tanpa item menu (form baru, detail `[id]`).

## 9. Verifikasi

1. `bunx turbo run typecheck lint --filter=cms`, lalu `bun run build` untuk CMS.
2. `bun run --filter cms test:e2e` memakai fixture sesuai `apps/cms/e2e/README.md`; ketiga file e2e harus lulus. Satu perubahan alur yang disanksikan: `production-readiness.test.ts` membuka drawer `Menu utama` sebelum mengeklik `Akun` (lokasi baru menu akun); selektor lain tidak berubah.
3. Cek kontras pasangan warna teks/latar yang berubah memakai `contrast-check.py` (target WCAG AA; tabel sidebar/teks muted sudah diverifikasi di refactor sebelumnya, ulangi untuk elemen baru).
4. Jalan-jalan keyboard: tab order header, sidebar, breadcrumb; Escape menutup drawer; fokus kembali ke trigger.
5. Cek viewport sempit (< 768px): tanpa scroll horizontal, target sentuh >= 44px, footer akun terjangkau di drawer.
6. Delivery Gate antislop dijalankan sebelum penyerahan (mode: during).

## 10. Risiko dan jawabannya

| Risiko | Jawaban |
| --- | --- |
| Header sticky menutupi konten saat anchor/skip link dipakai | `scroll-margin-top` pada `#cms-content`; uji skip link secara manual |
| Breadcrumb salah konteks saat slug asing | Breadcrumb hanya memakai slug yang valid dari `accessibleApps`; slug tak dikenal sudah dirender 403 oleh layout `[appSlug]` sebelum breadcrumb tampil |
| NavUser memanjangkan drawer mobile | Footer di akhir drawer, setelah menu; drawer scrollable bila layar pendek (perilaku Sheet bawaan) |
| Migrasi 7 halaman tabel melanggar aksi baris | Kolom dan aksi disalin dari halaman aslinya tanpa perubahan label; e2e production-readiness menjadi jaring pengaman |
