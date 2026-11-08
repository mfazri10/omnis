# F02 — Kerangka CMS & App Switcher

| Item | Detail |
|---|---|
| FR | FR-PLAT-02 |
| Fase | 1 |
| Prioritas | Must |
| Status | Belum mulai |
| Dependensi | F01, F03, F05 |

## Tujuan

Shell CMS (sidebar, header, app switcher) menjadi rangka semua layar; menu dan konteks data mengikuti aplikasi yang dipilih dan hak admin.

## Lingkup Backend

- [ ] Query daftar aplikasi yang boleh diakses admin login (untuk switcher)
- [ ] Query permission efektif admin per aplikasi (untuk render menu)
- [ ] Konteks request: validasi `X-App-Slug` → tolak slug fiktif / suspended / di luar hak (`APP_NOT_FOUND`, `APP_SUSPENDED`, `FORBIDDEN`)

## Lingkup CMS UI

- [ ] Layout shell: sidebar menu, header (app switcher + profil), area konten
- [ ] App switcher: daftar aplikasi yang boleh diakses; pilihan tersimpan antar sesi
- [ ] Menu global vs menu konteks aplikasi; item tanpa hak tidak ditampilkan
- [ ] Seluruh request GraphQL app-scoped otomatis membawa slug aplikasi aktif
- [ ] Penanganan error global: sesi habis, tidak punya akses, aplikasi di-suspend

## Kriteria Selesai

1. Admin dengan hak 1 aplikasi hanya melihat 1 aplikasi di switcher; Super Admin melihat semua.
2. Pindah aplikasi mengubah menu dan data yang tampil tanpa reload manual.
3. Request dengan slug aplikasi di luar hak ditolak server meskipun UI dimanipulasi.

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A2
- [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md) bagian 4.1
- [docs/07-api-design.md](../docs/07-api-design.md) bagian 1
