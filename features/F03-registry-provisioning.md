# F03 — Registry & Provisioning Aplikasi

| Item | Detail |
|---|---|
| FR | FR-PLAT-03, FR-PLAT-04 |
| Fase | 1 |
| Prioritas | Must |
| Status | Belum mulai |
| Dependensi | F00, F05 |

## Tujuan

Aplikasi baru bisa didaftarkan dan diprovisioning (database + migrasi + config awal) dari CMS dalam satu alur, tanpa perintah manual ke database.

## Lingkup Backend

- [ ] CRUD registry `apps` (nama, slug unik, ikon, status, info paket/bundle, URL store, catatan)
- [ ] Simpan kredensial FCM terenkripsi; tidak pernah terekspos utuh ke API
- [ ] Mutation `provisionApp`: buat DB → migrasi template (+ modul bila dipilih) → config awal → registry → audit; gagal = rollback bersih
- [ ] Mutation `suspendApp` / `archiveApp` / aktifkan kembali
- [ ] Seluruh operasi registry dijaga permission `platform.apps.*` (cakupan global)

## Lingkup CMS UI

- [ ] Daftar aplikasi (nama, slug, status, tanggal) + pencarian
- [ ] Form tambah aplikasi → jalankan provisioning dengan indikator progres + pesan gagal yang jelas
- [ ] Detail aplikasi: info paket, URL store, status FCM (terpasang/belum), aksi suspend/archive
- [ ] Form kredensial FCM (paste service account, tampil sebagai bertopeng setelah tersimpan)

## Kriteria Selesai

1. Provisioning aplikasi baru selesai tanpa perintah manual; App DB terbentuk + termigrasi + config awal ada.
2. Provisioning yang gagal di tengah tidak meninggalkan aplikasi setengah jadi (registry maupun DB).
3. Aplikasi suspended: konteksnya ditolak API dan hilang dari switcher non-global; datanya utuh.
4. Kredensial FCM tidak bisa dibaca utuh lewat API/CMS.

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A3
- [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md) bagian 4.2
- [docs/06-database-design.md](../docs/06-database-design.md) `apps`
