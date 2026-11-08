# F09 — Media Library

| Item | Detail |
|---|---|
| FR | FR-PLAT-12 |
| Fase | 1 |
| Prioritas | Must |
| Status | Belum mulai |
| Dependensi | F03, F05 |

## Tujuan

Tiap aplikasi punya perpustakaan media sendiri: unggah sekali, pakai ulang di modul (gambar soal, foto produk, sampul mosi, dsb.).

## Lingkup Backend

- [ ] Tabel `media` template di tiap App DB (nama, path, URL, tipe, ukuran, alt)
- [ ] `POST /uploads` (multipart): cek sesi + slug + permission `platform.media.create`, validasi tipe & ukuran, nama file acak, simpan ke prefix `{slug}/`, tulis metadata
- [ ] Query `media` (pencarian + pagination) + mutation `deleteMedia` (hapus metadata + file)
- [ ] Batas default: gambar maks 5 MB; tipe jpg/png/webp/pdf (dikonfigurasi)

## Lingkup CMS UI

- [ ] Galeri grid + pencarian + dialog unggah (progres + validasi sisi klien)
- [ ] Pemilih media yang bisa dipakai ulang dari form modul (soal, produk, kampanye, config)
- [ ] Aksi hapus dengan peringatan bila file sedang dipakai (cek referensi bila memungkinkan)

## Kriteria Selesai

1. Unggah dari konteks aplikasi A tersimpan di prefix A dan tercatat di App DB A.
2. File di luar tipe/ukuran ditolak server dengan pesan yang jelas.
3. Pemilih media bisa dipakai dari minimal satu form modul (dibuktikan penuh di F12).

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A9
- [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md) bagian 4.5
- [docs/07-api-design.md](../docs/07-api-design.md) bagian 5
