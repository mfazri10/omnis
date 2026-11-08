# F12 — Modul Pilot (Modul Domain Pertama)

| Item | Detail |
|---|---|
| FR | FR-CBT-01… / FR-POS-01… / FR-DEB-01… (satu saja) |
| Fase | 2 |
| Prioritas | Must (satu modul) |
| Status | Belum mulai — menunggu Q1 |
| Dependensi | F00–F10 (memakai seluruh pola platform) |

## Tujuan

Membangun modul domain aplikasi pertama sekaligus mengesahkan **pola modul baku** yang dipakai semua modul berikutnya.

> Modul mana yang pertama diputuskan di Q1 ([docs/10-keputusan-terbuka.md](../docs/10-keputusan-terbuka.md)). Usulan: Tes CPNS. File ini diisi detail setelah Q1 terjawab; kerangka di bawah berlaku untuk modul apa pun.

## Kerangka Wajib (pola modul baku)

- [ ] Entities + migrasi App DB-nya (tidak ada tabel domain di control-plane)
- [ ] Resolver GraphQL app-scoped + guard permission per operasi
- [ ] Katalog permission modul didaftarkan (`modul.entitas.aksi`) dan muncul di layar Role (F05)
- [ ] Layar CMS modul + pemakaian ulang pemilih media (F09)
- [ ] Kontribusi statistik ke dashboard aplikasi (F07)
- [ ] Aksi penting menulis audit log (F06)
- [ ] Dokumen rincian modul ditulis (menggantikan placeholder ini)

## Ringkasan Kandidat

| Kandidat | Entitas inti | Layar CMS inti |
|---|---|---|
| Tes CPNS (CBT, disarankan) | Bank soal, paket, sesi, hasil | Soal, paket, hasil & analitik, peserta |
| Ngewarung (POS) | Outlet, produk, stok, transaksi | Produk, stok, transaksi, laporan |
| Debat | Mosi, argumen, voting | Mosi, moderasi, laporan pengguna |

Asumsi domain tiap kandidat: [docs/10-keputusan-terbuka.md](../docs/10-keputusan-terbuka.md) bagian 3.

## Kriteria Selesai

1. Alur domain ujung-ke-ujung bisa dijalankan dari CMS dalam konteks aplikasinya.
2. Permission modul bisa dirangkai jadi role dari CMS tanpa ubah kode.
3. Checklist pola modul baku di atas terpenuhi semua — menjadi template F-modul berikutnya.

## Referensi

- [docs/02-prd.md](../docs/02-prd.md) bagian 5 (aturan baku modul)
- [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md) bagian 3 (pola modul)
- [docs/09-roadmap.md](../docs/09-roadmap.md) Fase 2
