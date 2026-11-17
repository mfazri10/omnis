# F09 — Media Library

| Item | Detail |
|---|---|
| FR | FR-PLAT-12 |
| Fase | 1 |
| Prioritas | Must |
| Status | Dikerjakan |
| Dependensi | F03, F05 |

## Tujuan

Tiap aplikasi punya perpustakaan media sendiri: unggah sekali, pakai ulang di modul (gambar soal, foto produk, sampul mosi, dsb.).

## Lingkup Backend

- [x] Tabel `media` template di tiap App DB (nama, path, URL, tipe, ukuran, alt)
- [x] `POST /uploads` (multipart): cek sesi + slug + permission `platform.media.create`, validasi tipe & ukuran, nama file acak, simpan ke prefix `{slug}/`, tulis metadata
- [x] Query `media` (pencarian + pagination) + mutation `deleteMedia` (hapus metadata + file)
- [x] Batas default: gambar maks 5 MB; tipe jpg/png/webp/pdf (dikonfigurasi)

## Lingkup CMS UI

- [x] Galeri grid + pencarian + dialog unggah (progres + validasi sisi klien)
- [x] Pemilih media yang bisa dipakai ulang dari form modul (soal, produk, kampanye, config)
- [x] Aksi hapus dengan peringatan bila file sedang dipakai (cek referensi bila memungkinkan)

## Kriteria Selesai

1. Unggah dari konteks aplikasi A tersimpan di prefix A dan tercatat di App DB A.
2. File di luar tipe/ukuran ditolak server dengan pesan yang jelas.
3. Pemilih media bisa dipakai dari minimal satu form modul (dibuktikan penuh di F12).

## Catatan Implementasi (Fase 1)

Status `Dikerjakan`, bukan `Selesai`: kriteria 1–2 terpenuhi di kode
dan diuji (unit mock + runtime manual), tetapi kriteria 3 belum —
komponen `MediaPicker` (`apps/cms/components/shared/media-picker.tsx`)
siap pakai (`open` + `onSelect({id,url,altText})`) namun belum dipakai
form modul mana pun karena form modul pertama baru ada di F12.

Keputusan Fase 1:

- Storage abstrak (`StorageDriver`: `put`/`delete`/`publicUrl`) dengan
  implementasi lokal (`STORAGE_LOCAL_ROOT`, default `./storage/media`).
  Driver S3 menyusul tanpa mengubah pemakai.
- Berkas lokal dilayani `GET /media/:slug/:file` (pengganti URL S3
  publik di dev; produksi memakai URL S3 langsung).
- Batas interceptor multipart 6 MB (backstop anti-OOM); batas service
  `UPLOAD_MAX_BYTES` default 5 MB dengan pesan menyebut batasnya.
- Validasi MIME ganda: content-type terkirim harus ada di daftar izin
  dan ekstensi nama berkas harus memetakan ke MIME izin yang sama.
- Cek referensi saat hapus belum memungkinkan (belum ada modul yang
  menyimpan referensi media); dialog hapus memuat peringatan eksplisit.

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A9
- [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md) bagian 4.5
- [docs/07-api-design.md](../docs/07-api-design.md) bagian 5
