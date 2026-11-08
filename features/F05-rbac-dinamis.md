# F05 — RBAC Dinamis

| Item | Detail |
|---|---|
| FR | FR-PLAT-06, FR-PLAT-07 |
| Fase | 1 |
| Prioritas | Must |
| Status | Belum mulai |
| Dependensi | F01 |

## Tujuan

Role dan permission dirangkai dari CMS (tidak hardcode), bercakupan global atau per aplikasi, dan ditegakkan di setiap operasi server.

## Lingkup Backend

- [ ] Tabel `roles`, `permissions`, `role_permissions`, `admin_role_assignments`
- [ ] Pola pendaftaran katalog permission oleh modul (`modul.entitas.aksi`) + seed saat booting
- [ ] CRUD role (cakupan `global`/`app`) + penetapan/pencabutan role ke admin
- [ ] Guard permission per operasi: Super Admin lewat; selainnya cek permission dalam cakupan konteks (`FORBIDDEN` + `requiredPermission`)
- [ ] Permission `platform.*` sensitif (apps, roles, admins) hanya untuk role global
- [ ] CRUD admin + aktif/nonaktifkan (nonaktif = sesi dicabut, berlaku segera)
- [ ] Proteksi: Super Admin aktif terakhir tidak bisa dinonaktifkan/dicabut
- [ ] Cache permission singkat + invalidasi saat role/penetapan berubah

## Lingkup CMS UI

- [ ] Daftar + form role: nama, deskripsi, cakupan, centang permission per kelompok modul
- [ ] Daftar admin + penetapan role (bisa multi-role, multi-aplikasi) + aksi aktif/nonaktifkan
- [ ] Tampilan "akses efektif" per admin (ringkasan aplikasi + permission)

## Kriteria Selesai

1. Role baru (mis. "Editor Soal" cakupan `tes-cpns`) bisa dibuat tanpa ubah kode dan langsung berlaku.
2. Admin dengan role terbatas ditolak (`FORBIDDEN`) di operasi luar haknya — termasuk bila memanggil API langsung.
3. Pencabutan role / penonaktifan admin berlaku paling lambat pada request berikutnya.
4. Upaya mencabut Super Admin terakhir ditolak dengan pesan yang jelas.

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A5
- [docs/04-user-role-permission.md](../docs/04-user-role-permission.md) (desain penuh)
- [docs/06-database-design.md](../docs/06-database-design.md) tabel role/permission
