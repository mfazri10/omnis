# F12 — Modul Pilot: CBT (Tes CPNS)

| Item | Detail |
|---|---|
| FR | FR-CBT-01… (modul pilot terpilih: Tes CPNS) |
| Fase | 2 |
| Prioritas | Must (satu modul) |
| Status | Selesai sebagian |
| Dependensi | F00–F11 (memakai seluruh pola platform) |

## Tujuan

Membangun modul domain aplikasi pertama sekaligus mengesahkan **pola modul baku** yang dipakai semua modul berikutnya.

Modul yang dibangun: **CBT (Tes CPNS)** — pilihan A pada [docs/10-keputusan-terbuka.md](../docs/10-keputusan-terbuka.md) Q1. Kerangka di bawah tetap berlaku untuk modul apa pun (POS, Debat).

## Kerangka Wajib (pola modul baku)

- [x] Entities + migrasi App DB-nya — 6 tabel `cbt_*` di scope migrasi `app-cbt`, tanpa tabel domain di control-plane
- [x] Resolver GraphQL app-scoped + guard permission per operasi — 3 resolver (`questions`, `packages`, `sessions`), tiap kelas `@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)` + `@RequirePermissions` per operasi
- [x] Katalog permission modul (`cbt.questions/packages/sessions/results` × `view/manage`) muncul di layar Role (F05) dan bisa dirangkai jadi role cakupan aplikasi tanpa ubah kode
- [x] Layar CMS modul + pemakaian ulang pemilih media (F09) — 4 halaman; `MediaPicker` dipakai di bank soal
- [x] Kontribusi statistik ke dashboard aplikasi (F07) — kartu "Soal CBT" lewat `DashboardSection`
- [x] Aksi penting menulis audit log (F06) — `entity_type` `cbt_question`, `cbt_package`, `cbt_session`
- [x] Dokumen rincian modul ditulis — dokumen ini menggantikan placeholder

## Lingkup Backend

- [x] Tabel App DB: `cbt_questions`, `cbt_packages`, `cbt_package_questions`, `cbt_sessions`, `cbt_answers`, `cbt_results`
- [x] Bank soal: kategori TWK/TIU/TKP, 5 opsi, kunci jawaban, bobot TKP (jsonb), gambar soal (URL dari F09), penjelasan, aktif/nonaktif, filter kategori/pencarian/status
- [x] Paket ujian: judul, durasi, passing grade per kategori (jsonb), komposisi soal berurutan
- [x] Sesi simulasi: mulai (peserta user aplikasi atau nama bebas), simpan jawaban, selesaikan → penilaian otomatis
- [x] Hasil & analitik: daftar hasil (filter paket/lulus), statistik paket (selesai, lulus, tingkat kelulusan, rata-rata per kategori, nilai tertinggi/terendah)
- [x] Permission `view` untuk baca, `manage` untuk tulis; semua operasi app-scoped lewat `@AppDb()`
- [x] Penolakan jelas untuk aplikasi yang belum memasang modul (Postgres 42P01 dipetakan jadi pesan, bukan INTERNAL_ERROR)
- [x] Modul terpasang otomatis saat provisioning bila dipilih (kolom `apps.modules`)

## Lingkup CMS UI

- [x] Bank soal: daftar + filter, form soal (termasuk pemilih gambar dari F09), aktif/nonaktif
- [x] Paket: daftar, form paket (durasi + passing grade per kategori), penyusun komposisi soal
- [x] Sesi: daftar sesi + filter status/paket, mulai simulasi, jawab, selesaikan, detail jawaban & hasil
- [x] Hasil: daftar hasil + analitik per paket
- [x] Menu modul hanya muncul di aplikasi yang memasang modulnya (`myApps.modules` → `appMenu`), lalu disaring permission per admin
- [x] Pemilih modul di form aplikasi baru (`platform/apps/new`)

## Kriteria Selesai

1. Alur domain ujung-ke-ujung bisa dijalankan dari CMS dalam konteks aplikasinya. Terpenuhi di API dan diverifikasi runtime (app `uji-cbt2`): buat soal TWK/TIU/TKP → buat paket (passing grade 5/5/5) → susun 3 soal → mulai simulasi → kirim 3 jawaban → selesaikan → hasil. Jawaban benar semua menghasilkan TWK 5 / TIU 5 / TKP 5 / total 15 dengan `passed=true`; sesi kedua dengan TKP dijawab C (bobot 3) menghasilkan total 13 dengan `passed=false`; statistik paket melaporkan 2 selesai, 1 lulus. Ke-16 dokumen GraphQL CMS dijalankan apa adanya terhadap schema live dan 15 cocok (sisanya temuan pesan validasi, lihat di bawah). Halaman CMS-nya belum diuji klik di browser.
2. Permission modul bisa dirangkai jadi role dari CMS tanpa ubah kode. Terpenuhi, diverifikasi runtime: role cakupan aplikasi "Editor Soal Uji" hanya memegang `cbt.questions.view`; admin pemegangnya bisa membaca bank soal, dan ditolak `FORBIDDEN` untuk `createCbtQuestion`, `cbtPackages`, dan `cbtResults`. Tanpa sesi, semua query modul menjawab `UNAUTHENTICATED`.
3. Checklist pola modul baku terpenuhi semua — menjadi template F-modul berikutnya. Terpenuhi; seluruh butir di atas tercentang dengan lokasi implementasinya.

## Verifikasi (22 Nov 2026)

- `bun x turbo run typecheck lint test build --force` → 7 successful, 0 cached.
- Tes API: 48 suite / 463 tes lulus (termasuk `scoring.spec.ts`, `cbt-resolver-metadata.spec.ts`, spec repository dan service).
- Uji runtime lewat GraphQL ke API dev :3010 dengan sesi better-auth: 18 dari 20 cek lolos. Dua cek yang gagal adalah fixture uji saya sendiri — password admin `f11noperm@contoh.id` sudah basi (sign-in 401), bukan bug kode; kasus yang sama diuji ulang dengan admin yang baru dibuat dan hasilnya benar.
- Uji negatif: tanpa sesi `UNAUTHENTICATED`; admin tanpa `manage` `FORBIDDEN`; aplikasi tanpa modul → `BAD_USER_INPUT` dengan pesan "Modul CBT belum terpasang di aplikasi ini. Terapkan migrasi app-cbt ke App DB aplikasi."; soal TKP tanpa `tkpWeights` ditolak.
- DB: `app_uji_cbt2` memuat 6 tabel `cbt_*` dan riwayat `schema_migrations` dua scope (`app-template`, `app-cbt`); `platform.apps.modules` jsonb default `'[]'`; migrasi `20261121000003_platform_apps_modules` tercatat; audit log berisi 9 `cbt_question`, 5 `cbt_package`, 8 `cbt_session`.
- Admin uji `uji-cbt-limit@contoh.id` dinonaktifkan kembali setelah pengujian.

## Temuan Terbuka

1. Pesan error validasi GraphQL seragam jadi "Bad Request Exception". `ValidationPipe` menaruh pesan detail di objek respons, sedangkan `graphql-exception.filter.ts` memakai `exception.message` dan membuang `message` dari sisa objek. Contoh nyata: `passingGrade.twk = -1` dijawab "Bad Request Exception", bukan pesan aturan bisnis. Berlaku untuk seluruh modul, bukan hanya CBT; belum diperbaiki.
2. Halaman CMS modul (4 halaman) lulus build/typecheck dan dokumen GraphQL-nya teruji terhadap schema live, tetapi belum diuji klik di browser — belum ada sesi CMS yang bisa dipakai otomatis untuk itu.
3. Ekspor CSV hasil CBT (F11) belum didaftarkan ke registry sumber ekspor; modulnya sudah ada, jadi tinggal mendaftarkan sumbernya.
4. Aplikasi hasil uji (`uji-cbt`, `uji-cbt2`) masih ada di registry dev.

## Catatan Implementasi (keputusan)

- **Satu App DB menerima beberapa scope migrasi.** Kolom `schema_migrations.scope` (varchar, di-backfill dari pola nama untuk baris lama) memisahkan riwayat per scope; `validateHistory` dan `migrateDown` menyaring per scope, jadi riwayat `app-template` tidak dianggap "file hilang" saat menjalankan `app-cbt`. Scope `app-cbt` tinggal di `src/database/migration/` agar terkompilasi ke `dist` dan bisa dijalankan in-process oleh saga.
- **Daftar modul ada di kode, bukan tabel.** `KNOWN_MODULES = ["cbt"]` dan `MODULE_MIGRATION_SCOPES = { cbt: "app-cbt" }` di `provisioning.service.ts`; modul di luar daftar ditolak `BadRequestException` yang menyebut modul yang dikenal. Migrasi modul dijalankan setelah `app-template` dengan urutan tetap agar retry menghasilkan App DB yang sama.
- **Gating menu dari data registry.** `myApps` mengembalikan `modules`, lalu `appMenu(slug, modules)` menambah item modul; permission tetap menyaring per admin. Form aplikasi baru menyediakan pemilih modul yang ikut dimigrasi saat provisioning.
- **42P01 dipetakan, bukan dibiarkan.** `CbtTablesInterceptor` mengubah `undefined_table` jadi pesan yang bisa ditindaklanjuti; kartu dasbor mengembalikan 0 dengan hint "Modul CBT belum terpasang di aplikasi ini" supaya dasbor aplikasi lain tetap tampil. Deteksi memeriksa `code`, `driverError.code`, dan `cause.code` karena Drizzle membungkus `DatabaseError` pg sebagai `cause`.
- **Aturan penskoran** (`scoring.ts`, fungsi murni): TWK/TIU benar 5, salah atau kosong 0; TKP = bobot opsi terpilih (1–5), kosong 0; lulus bila SEMUA kategori mencapai passing grade paket. `tkpWeights` wajib lengkap A–E dengan bobot 1–5.
- **Dokumen GraphQL CMS masih manual** (`features/cbt/graphql/cbt.graphql.ts`) dengan penanda TODO untuk diganti hasil codegen saat codegen dikonfigurasi.

## Referensi

- [docs/02-prd.md](../docs/02-prd.md) bagian 5 (aturan baku modul)
- [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md) bagian 3 (pola modul)
- [docs/06-database-design.md](../docs/06-database-design.md)
- [docs/09-roadmap.md](../docs/09-roadmap.md) Fase 2
- [docs/10-keputusan-terbuka.md](../docs/10-keputusan-terbuka.md) Q1
