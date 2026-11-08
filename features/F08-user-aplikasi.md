# F08 — Manajemen User Aplikasi

| Item | Detail |
|---|---|
| FR | FR-PLAT-11 |
| Fase | 1 |
| Prioritas | Must |
| Status | Belum mulai |
| Dependensi | F03, F05 |

## Tujuan

Admin bisa melihat, mencari, dan menonaktifkan user aplikasinya (data terisolasi per App DB). Login user aplikasi sendiri dikerjakan di fase mobile, bukan di sini.

## Lingkup Backend

- [ ] Tabel `users` template di tiap App DB (nama, email/HP unik, avatar, status, metadata, login terakhir)
- [ ] Query `appUsers` (pencarian + filter status + pagination) pada koneksi App DB konteks
- [ ] Mutation `setAppUserActive` (permission `platform.users.manage` dalam cakupan)
- [ ] Mutation tambah/ubah user dari CMS (untuk pengisian awal sebelum registrasi mobile ada)

## Lingkup CMS UI

- [ ] Daftar user per aplikasi + pencarian + filter status
- [ ] Detail user + riwayat ringkas (aktivitas terkait bila modulnya sudah ada)
- [ ] Aksi aktif/nonaktifkan dengan konfirmasi

## Kriteria Selesai

1. Daftar user aplikasi A tidak pernah menampilkan user aplikasi B.
2. Nonaktifkan user tercatat di audit log dengan aplikasi yang benar.
3. Operasi ditolak untuk admin tanpa `platform.users.manage` dalam cakupannya.

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A8
- [docs/06-database-design.md](../docs/06-database-design.md) `users`
