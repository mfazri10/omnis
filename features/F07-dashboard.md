# F07 — Dashboard Global & per Aplikasi

| Item | Detail |
|---|---|
| FR | FR-PLAT-09, FR-PLAT-10 |
| Fase | 1 |
| Prioritas | Must |
| Status | Selesai (implementasi + uji mock; uji runtime oleh reviewer) |
| Dependensi | F03, F08, F10 |

## Tujuan

Super Admin melihat kesehatan seluruh platform sekilas; admin aplikasi melihat ringkasan aplikasinya tanpa membuka tiap menu.

## Lingkup Backend

- [x] Query `platformDashboard`: kartu per aplikasi (status, jumlah user, aktivitas 7 hari), aktivitas platform terakhir, status antrian notifikasi
- [x] Query `appDashboard`: statistik modul aplikasi itu + aktivitas terakhir dalam cakupannya
- [x] Pola kontribusi statistik oleh modul domain (agar modul baru otomatis muncul di dashboard)
- [x] Agregat dihitung efisien (tanpa N+1; cache singkat bila perlu)

## Lingkup CMS UI

- [x] Halaman dashboard global (menu global): kartu aplikasi + aktivitas + status antrian
- [x] Halaman dashboard per aplikasi (menu konteks): kartu statistik modul + aktivitas terakhir
- [x] Kartu yang datanya kosong tampil jujur (nol/belum ada data), bukan error

## Kriteria Selesai

1. Dashboard global menampilkan semua aplikasi + angka yang cocok dengan data mentahnya.
2. Dashboard per aplikasi hanya menampilkan data aplikasi dalam konteks.
3. Menambah modul domain baru tidak merusak dashboard (pola kontribusi terdokumentasi — dipakai F12).

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A7
- [docs/07-api-design.md](../docs/07-api-design.md) bagian 2 & 3
