# F10 — Notifikasi Push

| Item | Detail |
|---|---|
| FR | FR-PLAT-13, FR-PLAT-14 |
| Fase | 1 |
| Prioritas | Must |
| Status | Dikerjakan |
| Dependensi | F03, F05, F08 |

## Tujuan

Admin bisa membuat dan menjadwalkan kampanye push per aplikasi; worker mengirim tepat waktu via FCM dan mencatat hasilnya.

## Lingkup Backend

- [x] Tabel `notification_campaigns` (control-plane): judul, isi, gambar, target halaman, audiens, jadwal, status, agregat hasil
- [x] CRUD kampanye + `sendCampaignNow` + `cancelCampaign` (permission `platform.notifications.*`)
- [ ] Worker BullMQ + Redis: eksekusi terjadwal, ambil token dari App DB target, kirim via FCM (kredensial aplikasi dari registry)
  - [x] Pengganti Fase 1: `CampaignRunnerService` in-process (`setInterval` 30 detik, klaim berkunci per kampanye)
  - [x] Pengganti Fase 1: `PushSender` + `NoopPushSender` (tanpa jaringan; FCM nyata menyusul)
- [x] Catat `target/sent/failed_count`; bersihkan token basi; kampanye gagal bisa dilihat alasannya (via audit log)
- [x] Segmen sederhana v1 (`last_active_days` di atas `device_tokens.last_seen_at`); segmen kompleks = lanjutan

## Lingkup CMS UI

- [x] Daftar kampanye (status, jadwal, hasil) + form buat/ubah (judul, isi, gambar via F09, target halaman, audiens, jadwal)
- [x] Aksi kirim sekarang / batalkan terjadwal dengan konfirmasi
- [x] Detail hasil pengiriman per kampanye

## Kriteria Selesai

1. Kampanye terjadwal tereksekusi pada waktunya (toleransi ≤ 1 menit) dan status beralih `scheduled → sending → sent`.
2. Hasil agregat tercatat benar; token basi dibersihkan otomatis.
3. Kampanye aplikasi A tidak pernah menyentuh token aplikasi B.
4. Tanpa token perangkat (sebelum fase mobile), eksekusi tetap berjalan dan tercatat `target_count = 0` — bukan error.

## Catatan Implementasi (Fase 1)

Status `Dikerjakan`, bukan `Selesai`: seluruh lingkup di atas
diimplementasikan dan diuji (unit mock + typecheck + lint + build),
tetapi uji runtime (migrasi + boot + kirim nyata) menjadi wewenang
reviewer manusia.

Pengecualian yang disengaja (keputusan desain, bukan kelalaian):

- Penjadwalan in-process, bukan BullMQ: paket `bullmq`/`@nestjs/bullmq`
  tidak terpasang dan menambah dependency dilarang. `CampaignRunnerService`
  menyapu tiap 30 detik (`CAMPAIGN_RUNNER_INTERVAL_MS`, mati saat
  `NODE_ENV=test` atau `CAMPAIGN_RUNNER=off`), sehingga toleransi
  ≤1 menit pada kriteria 1 tetap terpenuhi. Klaim antar-instance
  dikunci di repository (`UPDATE ... WHERE status='scheduled'`
  per kampanye; yang kalah mengembalikan 0 baris dan dilewati).
  BullMQ + Redis menyusul tanpa mengubah kontrak service.
- Pengiriman FCM diganti `NoopPushSender` (env `PUSH_DRIVER=noop`,
  satu-satunya nilai valid Fase 1): mencatat ke console, tanpa
  jaringan, selalu `sent`. Bukan bukti pengiriman FCM nyata;
  driver FCM (memakai kredensial registry + `firebase-admin`)
  menyusul di implementasi `PushSender` yang sama.
- Alasan gagal tercatat di audit log (`action: send` + ringkasan
  alasan), karena skema tak punya kolom alasan gagal.
- Runner melewati kampanye milik aplikasi nonaktif (dikembalikan ke
  `scheduled`, dikirim setelah aplikasi aktif lagi); aksi manual
  admin tetap jalan karena guard CMS sudah memveto konteksnya.
- Indeks yang dibuat: `(app_id, created_at DESC)` untuk daftar dan
  `(status, scheduled_at)` untuk runner, sesuai kebutuhan query
  nyata (sedikit berbeda dari indeks gabungan di doc 06).

Keputusan lain:

- Segmen v1: kolom `last_seen_at` ADA di `device_tokens`, sehingga
  `{"last_active_days": N}` benar-benar memfilter; segmen tanpa
  kriteria valid diperlakukan sebagai `all`.
- Koneksi App DB selalu diturunkan dari `app_id` kampanye
  (lookup slug → `getAppConnection`), bukan dari header request;
  operasi CMS tetap divalidasi milik aplikasi konteks (kriteria 3).
- `scheduledAt` di masa depan → `scheduled`, selebihnya `draft`
  (termasuk tanggal lewat: disimpan apa adanya, tak pernah
  dieksekusi runner karena statusnya `draft`).

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A10
- [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md) bagian 4.4
- [docs/06-database-design.md](../docs/06-database-design.md) `notification_campaigns`, `device_tokens`
