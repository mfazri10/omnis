# F10 — Notifikasi Push

| Item | Detail |
|---|---|
| FR | FR-PLAT-13, FR-PLAT-14 |
| Fase | 1 |
| Prioritas | Must |
| Status | Belum mulai |
| Dependensi | F03, F05, F08 |

## Tujuan

Admin bisa membuat dan menjadwalkan kampanye push per aplikasi; worker mengirim tepat waktu via FCM dan mencatat hasilnya.

## Lingkup Backend

- [ ] Tabel `notification_campaigns` (control-plane): judul, isi, gambar, target halaman, audiens, jadwal, status, agregat hasil
- [ ] CRUD kampanye + `sendCampaignNow` + `cancelCampaign` (permission `platform.notifications.*`)
- [ ] Worker BullMQ + Redis: eksekusi terjadwal, ambil token dari App DB target, kirim via FCM (kredensial aplikasi dari registry)
- [ ] Catat `target/sent/failed_count`; bersihkan token basi; kampanye gagal bisa dilihat alasannya
- [ ] Segmen sederhana v1 (mis. pengguna aktif 30 hari); segmen kompleks = lanjutan

## Lingkup CMS UI

- [ ] Daftar kampanye (status, jadwal, hasil) + form buat/ubah (judul, isi, gambar via F09, target halaman, audiens, jadwal)
- [ ] Aksi kirim sekarang / batalkan terjadwal dengan konfirmasi
- [ ] Detail hasil pengiriman per kampanye

## Kriteria Selesai

1. Kampanye terjadwal tereksekusi pada waktunya (toleransi ≤ 1 menit) dan status beralih `scheduled → sending → sent`.
2. Hasil agregat tercatat benar; token basi dibersihkan otomatis.
3. Kampanye aplikasi A tidak pernah menyentuh token aplikasi B.
4. Tanpa token perangkat (sebelum fase mobile), eksekusi tetap berjalan dan tercatat `target_count = 0` — bukan error.

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A10
- [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md) bagian 4.4
- [docs/06-database-design.md](../docs/06-database-design.md) `notification_campaigns`, `device_tokens`
