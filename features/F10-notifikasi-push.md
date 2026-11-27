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
- [x] Worker BullMQ + Redis: pemindaian terjadwal oleh proses worker terpisah; klaim database mencegah job ganda
- [x] FCM memakai kredensial aplikasi yang dienkripsi di control-plane; token invalid dibersihkan
- [x] Catat target, terkirim, gagal, dan hasil ambigu; alasan kegagalan dicatat di audit log
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

## Catatan Implementasi

Status `Dikerjakan`, bukan `Selesai`: seluruh lingkup di atas
diimplementasikan dan diuji (unit mock + typecheck + lint + build),
tetapi uji runtime (migrasi + boot + kirim nyata) menjadi wewenang
reviewer manusia.

- `bun run --filter api worker` menjalankan worker kampanye dan ekspor;
  API tidak menjalankan polling in-process di production. Development dapat
  memakai runner lokal tanpa menyalakan worker.
- `PUSH_DRIVER=noop` hanya untuk development dan mencatat status `simulated`;
  nilai itu tidak menambah `sent_count`. Production mewajibkan
  `PUSH_DRIVER=fcm`, `FCM_CREDENTIAL_KEY`, dan service account per aplikasi.
- Jika koneksi FCM putus sehingga penerimaan pesan tak bisa dipastikan,
  kampanye menjadi `unknown`. Worker tidak mengirim ulang otomatis;
  setelah 10 menit tanpa heartbeat, kampanye `sending` juga direkonsiliasi
  menjadi `unknown`. Hitungan hasil tiap penerima terlihat melalui
  `sent_count`, `failed_count`, `simulated_count`, dan `unknown_count`.
- Pengiriman nyata belum diverifikasi karena tidak ada service account/token
  uji. Unit tests memakai hasil provider yang dikontrol dan tidak memanggil FCM.
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
