# 02 — PRD (Product Requirements Document)

Sumber kebenaran kebutuhan. Jika berbeda dengan dokumen lain, dokumen ini yang berlaku sampai direvisi bersama.

## 1. Ringkasan Produk

Platform CMS multi-aplikasi dengan tiga lapis:

1. **Platform/control-plane** — registry & provisioning aplikasi, auth admin, RBAC dinamis, audit log, remote config per aplikasi, media, notifikasi.
2. **Modul domain per aplikasi** — dibangun satu per satu: Tes CPNS (CBT), Ngewarung (POS), Debat.
3. **Aplikasi mobile** — konsumen API di fase berikutnya; bukan scope Fase 1.

Prinsip: **isolasi penuh per aplikasi** (database sendiri, user sendiri), **satu pintu kendali** (CMS + control-plane).

## 2. Masalah yang Diselesaikan

| Masalah | Tanpa platform ini | Solusi |
|---|---|---|
| Tiap aplikasi butuh panel admin sendiri | N panel berbeda, N sistem login admin | Satu CMS + app switcher |
| Data aplikasi tercampur | Sulit dipisah, bocor antar aplikasi | Satu DB per aplikasi sejak hari pertama |
| Hak akses hardcode di kode | Tambah peran = ubah kode + deploy | Role & permission diatur dari CMS |
| Aplikasi baru = proyek baru | Ulangi fondasi (auth, media, notif) | Provisioning: fondasi langsung tersedia |
| Perubahan butuh rilis mobile | Tergantung review store | Remote config per aplikasi |

## 3. User Story Utama

### Super Admin

- Sebagai Super Admin, saya ingin mendaftarkan aplikasi baru (nama, slug, DB, config awal) dari CMS agar fondasinya langsung siap dipakai.
- Sebagai Super Admin, saya ingin membuat role baru (mis. "Editor Soal") berisi permission pilihan agar tim punya hak pas tanpa ubah kode.
- Sebagai Super Admin, saya ingin memberi admin akses hanya ke aplikasi tertentu agar data aplikasi lain tidak terlihat olehnya.

### Admin Aplikasi / Operator

- Sebagai Admin Tes CPNS, saya ingin mengelola bank soal dan paket ujian agar materi selalu mutakhir.
- Sebagai Admin Ngewarung, saya ingin mengelola produk dan melihat riwayat transaksi per outlet.
- Sebagai Moderator Debat, saya ingin menyetujui/menolak argumen dan laporan pengguna.
- Sebagai Admin, saya ingin menjadwalkan push notification ke user aplikasi saya.
- Sebagai Admin, saya ingin mengaktifkan maintenance mode / menaikkan versi minimum aplikasi saya saat darurat.

### Viewer

- Sebagai pemilik usaha, saya ingin melihat dashboard penjualan Ngewarung tanpa bisa mengubah data.

## 4. Kebutuhan Fungsional — Platform (Fase 1)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-PLAT-01 | Login admin (email + kata sandi via better-auth), sesi cookie, logout, lupa/reset kata sandi via email | Must |
| FR-PLAT-02 | App switcher: pilih aplikasi aktif; seluruh menu & data mengikuti konteksnya | Must |
| FR-PLAT-03 | Registry aplikasi (CRUD): nama, slug, ikon, status, kredensial integrasi (FCM), URL store, info paket/bundle | Must |
| FR-PLAT-04 | Provisioning aplikasi baru: buat App DB + migrasi + config awal + catat di registry (satu alur) | Must |
| FR-PLAT-05 | Remote config per aplikasi: maintenance + pesan, versi minimum Android/iOS, tema dasar (nama, logo, warna primer), kontak dukungan | Must |
| FR-PLAT-06 | RBAC dinamis: katalog permission per modul, CRUD role (cakupan global/per aplikasi), penetapan role ke admin per aplikasi | Must |
| FR-PLAT-07 | Manajemen admin: CRUD, aktif/nonaktif; admin nonaktif langsung kehilangan akses (sesi dicabut) | Must |
| FR-PLAT-08 | Audit log lintas aplikasi: siapa, kapan, aplikasi apa, aksi apa — hanya baca | Must |
| FR-PLAT-09 | Dashboard global (Super Admin): daftar aplikasi + status + statistik ringkas per aplikasi | Must |
| FR-PLAT-10 | Dashboard per aplikasi: statistik modul + aktivitas terakhir | Must |
| FR-PLAT-11 | Manajemen user aplikasi (per konteks aplikasi): daftar, cari, detail, aktif/nonaktifkan | Must |
| FR-PLAT-12 | Media library per aplikasi: unggah, cari, pakai ulang; file di object storage dengan prefix per aplikasi | Must |
| FR-PLAT-13 | Kampanye push notification per aplikasi: buat, target (semua/segmen), jadwal, kirim, riwayat + jumlah terkirim | Must |
| FR-PLAT-14 | Pekerja pengiriman terjadwal (antrian): eksekusi kampanye tepat waktu, catat hasil, bersihkan token basi | Must |
| FR-PLAT-15 | Ekspor data tabel (CSV) pada daftar utama | Should |

## 5. Kebutuhan Fungsional — Modul Domain

Rincian penuh tiap modul ditulis sebagai dokumen tersendiri saat fasenya dimulai. Fase 1 membangun **modul pilot** (satu aplikasi, lihat keputusan terbuka); modul lain mengikuti pola yang sama di fase berikutnya.

| ID | Modul | Isi ringkas | Rincian |
|---|---|---|---|
| FR-CBT-01… | Tes CPNS | Bank soal (TWK/TIU/TKP), paket ujian + passing grade, sesi & penilaian otomatis, hasil & analitik, peserta | Menyusul di fasenya |
| FR-POS-01… | Ngewarung | Outlet, kategori, produk, stok, transaksi & pembayaran (catat manual), laporan penjualan | Menyusul di fasenya |
| FR-DEB-01… | Debat | Mosi, sisi pro/kontra, argumen + moderasi, voting, laporan pengguna | Menyusul di fasenya |

Aturan baku setiap modul domain (berlaku untuk modul pilot maupun berikutnya):

1. Tabel modul tinggal di App DB-nya sendiri; tidak ada tabel domain di control-plane.
2. Modul mendaftarkan katalog permission-nya (`modul.entitas.aksi`) agar bisa dirangkai jadi role dari CMS.
3. Modul menyediakan operasi GraphQL app-scoped + layar CMS-nya.
4. Modul menyediakan statistik ringkas untuk dashboard per aplikasi.

## 6. Kebutuhan Non-Fungsional

| Aspek | Target |
|---|---|
| Performa GraphQL | p95 < 500 ms untuk query daftar/detail admin pada beban normal; N+1 dicegah dengan dataloader |
| Keamanan | Kata sandi hanya di better-auth (hash), HTTPS wajib, sesi kedaluwarsa, otorisasi per permission di server, upload divalidasi tipe & ukuran |
| Isolasi data | Resolver app-scoped tidak pernah bisa membaca App DB lain; konteks aplikasi dari server, bukan dari input yang dipercaya buta |
| Backup | Backup otomatis harian control-plane DB + semua App DB; retensi ≥ 7 hari; uji restore berkala |
| Observabilitas | Log error terpusat; health-check; metrik antrian notifikasi |
| Provisioning | Aplikasi baru siap (DB + migrasi + config) dalam satu alur tanpa perintah manual ke database |

## 7. Kriteria Penerimaan — Fase 1 (CMS/Platform, tanpa mobile)

1. Super Admin login, provisioning aplikasi baru `debat`: registry terisi, App DB terbentuk + termigrasi, config awal tersedia — tanpa perintah manual ke database.
2. Super Admin membuat role "Editor Soal" (cakupan `tes-cpns`) berisi permission bank soal saja; admin dengan role itu bisa kelola soal tetapi ditolak (`forbidden`) saat membuka menu aplikasi lain, pengaturan platform, dan manajemen admin — di UI maupun API.
3. Admin modul pilot menjalankan alur domain ujung-ke-ujung dari CMS (mis. CBT: buat soal → susun paket → simulasikan penilaian).
4. Admin membuat kampanye notifikasi terjadwal; pekerja antrian mengeksekusinya tepat waktu dan mencatat hasil (meski token perangkat belum ada sebelum fase mobile).
5. Admin mengaktifkan maintenance mode dan menaikkan versi minimum; query `appConfig` mengembalikan nilai baru.
6. Admin dinonaktifkan di tengah sesi aktif → akses berikutnya langsung ditolak.
7. Setiap aksi penting tercatat di audit log dengan aplikasi, aktor, dan waktu yang benar.

## 8. Di Luar Ruang Lingkup Fase 1

- Aplikasi mobile, login user aplikasi, dan deep link.
- Integrasi payment gateway/QRIS, printer struk, dan hardware POS.
- Subscription realtime dan analitik lanjutan (funnel, cohort, retensi).
- Impor massal (CSV/Excel) — Should di tiap modul, boleh mundur satu fase.
