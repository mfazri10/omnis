# F04 — Remote Config per Aplikasi

| Item | Detail |
|---|---|
| FR | FR-PLAT-05 |
| Fase | 1 |
| Prioritas | Must |
| Status | Belum mulai |
| Dependensi | F03, F05 |

## Tujuan

Setiap aplikasi punya saklar operasional jarak jauh (maintenance, versi minimum, identitas, kontak) yang diatur dari CMS dan dibaca via query `appConfig`.

## Lingkup Backend

- [ ] Tabel `app_configs` (satu baris per aplikasi) + query `appConfig` (app-scoped)
- [ ] Mutation `updateAppConfig` (permission `platform.app-config.manage` dalam cakupan)
- [ ] Validasi: format versi, URL store, kode warna hex
- [ ] Perubahan config menulis audit log

## Lingkup CMS UI

- [ ] Layar Pengaturan per aplikasi: maintenance (saklar + pesan), versi minimum Android/iOS + URL store, identitas (nama tampil, logo, warna primer), kontak dukungan
- [ ] Pratinjau nilai efektif (gabungan registry + config) sebelum disimpan

## Kriteria Selesai

1. Ubah config dari CMS → query `appConfig` mengembalikan nilai baru.
2. Maintenance aktif + versi minimum naik tercermin benar di respons query.
3. Admin tanpa `platform.app-config.manage` ditolak di UI dan API.
4. Perubahan tercatat di audit log dengan aplikasi yang benar.

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A4
- [docs/06-database-design.md](../docs/06-database-design.md) `app_configs`
- [docs/07-api-design.md](../docs/07-api-design.md) bagian 3
