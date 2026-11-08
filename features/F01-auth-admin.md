# F01 — Auth Admin

| Item | Detail |
|---|---|
| FR | FR-PLAT-01 |
| Fase | 1 |
| Prioritas | Must |
| Status | Belum mulai |
| Dependensi | F00 |

## Tujuan

Admin bisa masuk CMS dengan email + kata sandi secara aman; sesi bisa dicabut saat admin dinonaktifkan.

## Lingkup Backend

- [ ] better-auth terpasang pada control-plane DB (tabel `user`, `session`, `account`, `verification`)
- [ ] Profil `admins` tertaut ke identitas better-auth (`auth_user_id`)
- [ ] Sign-in / sign-out / sesi cookie (`httpOnly`, `secure`, `sameSite`)
- [ ] Lupa kata sandi: kirim tautan reset via email + atur ulang bertoken kedaluwarsa
- [ ] Ganti kata sandi dari profil (wajib kata sandi lama)
- [ ] Guard autentikasi: tolak request bersesi tidak valid / profil nonaktif (`UNAUTHENTICATED`)
- [ ] Rate limit pada sign-in dan lupa kata sandi
- [ ] Seed Super Admin pertama via perintah terkendali (bukan data statis di repo)

## Lingkup CMS UI

- [ ] Halaman login (pesan error generik), lupa kata sandi, atur ulang kata sandi
- [ ] Menu profil: ganti kata sandi, logout
- [ ] Pengalihan otomatis ke login bila sesi habis; pesan yang jelas

## Kriteria Selesai

1. Login → akses halaman CMS; logout → sesi tidak bisa dipakai lagi.
2. Tautan reset dari email benar-benar bisa dipakai sekali dan kedaluwarsa.
3. Admin yang dinonaktifkan langsung ditolak pada request berikutnya.
4. Brute force login tertahan rate limit.

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A1
- [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md) bagian 4.3 & 5
- [docs/06-database-design.md](../docs/06-database-design.md) `admins` + tabel better-auth
