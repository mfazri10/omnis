# F11 — Ekspor CSV

| Item | Detail |
|---|---|
| FR | FR-PLAT-15 |
| Fase | 1–2 (Should — boleh mundur satu fase) |
| Prioritas | Should |
| Status | Belum mulai |
| Dependensi | Mengikuti tiap daftar (F08, modul domain, dst.) |

## Tujuan

Daftar data utama bisa diunduh sebagai CSV untuk pelaporan dan arsip, tanpa membebani API interaktif.

## Lingkup Backend

- [ ] Pola ekspor generik: filter yang sama dengan tampilan daftar → job latar → file CSV → tautan unduh kedaluwarsa
- [ ] Batas wajar (maks baris per ekspor, satu job per admin dalam satu waktu)
- [ ] Prioritas tabel: user aplikasi, transaksi (POS), hasil ujian (CBT), audit log
- [ ] Permission mengikuti permission `view` tabel sumbernya

## Lingkup CMS UI

- [ ] Tombol Ekspor pada daftar yang didukung + indikator progres + unduh hasil
- [ ] Pesan jelas bila data kosong atau melebihi batas

## Kriteria Selesai

1. Ekspor user aplikasi menghasilkan CSV yang isinya cocok dengan filter tampilan.
2. Ekspor besar tidak membuat request API timeout (berjalan sebagai job).
3. File hasil tidak bisa diakses tanpa sesi yang sah dan kedaluwarsa otomatis.

## Referensi

- [docs/02-prd.md](../docs/02-prd.md) FR-PLAT-15
