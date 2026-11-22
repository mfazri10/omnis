# F11 — Ekspor CSV

| Item | Detail |
|---|---|
| FR | FR-PLAT-15 |
| Fase | 1–2 (Should — boleh mundur satu fase) |
| Prioritas | Should |
| Status | Selesai sebagian (transaksi POS menunggu modulnya) |
| Dependensi | Mengikuti tiap daftar (F08, modul domain, dst.) |

## Tujuan

Daftar data utama bisa diunduh sebagai CSV untuk pelaporan dan arsip, tanpa membebani API interaktif.

## Lingkup Backend

- [x] Pola ekspor generik: filter yang sama dengan tampilan daftar → job latar → file CSV → tautan unduh kedaluwarsa
- [x] Batas wajar (maks baris per ekspor, satu job per admin dalam satu waktu)
- [ ] Prioritas tabel: user aplikasi, transaksi (POS), hasil ujian (CBT), audit log (user aplikasi, audit log, dan hasil ujian CBT sudah ada; transaksi POS menunggu modulnya)
- [x] Permission mengikuti permission `view` tabel sumbernya

## Lingkup CMS UI

- [x] Tombol Ekspor pada daftar yang didukung + indikator progres + unduh hasil
- [x] Pesan jelas bila data kosong atau melebihi batas

## Kriteria Selesai

1. Ekspor user aplikasi menghasilkan CSV yang isinya cocok dengan filter tampilan. Terpenuhi, diverifikasi runtime di API dev (app `uji-f08a`): ekspor filter `inactive` menghasilkan CSV 3 baris yang cocok persis dengan isi tabel `users` (termasuk user lama), urutan sama dengan daftar; nama berkoma/kutip ter-quote RFC 4180 dan sel berawalan `=`/`+` diprefiks apostrof (proteksi CSV injection). Dokumen GraphQL CMS dijalankan apa adanya terhadap schema live dan cocok.
2. Ekspor besar tidak membuat request API timeout (berjalan sebagai job). Terpenuhi, diverifikasi runtime: mutation mengembalikan job `QUEUED` seketika, runner in-process menyelesaikannya jadi `DONE` dalam beberapa detik; request kedua saat job aktif ditolak dengan pesan jelas, dan job `running` yang macet >10 menit dipulihkan jadi `failed` oleh sweep.
3. File hasil tidak bisa diakses tanpa sesi yang sah dan kedaluwarsa otomatis. Terpenuhi, diverifikasi runtime: unduh tanpa cookie = 401; unduh job admin lain = 404 (GraphQL `exportJob` = NOT_FOUND); admin tanpa permission = FORBIDDEN; `expires_at` dimundurkan lewat SQL lalu sweep mengubah status jadi `EXPIRED`, menghapus berkas dari disk, dan unduhan menjawab 410; berkas tidak tersaji lewat endpoint publik `/media` (404). Audit `export` dan `download` tercatat di `activity_logs`.

Sumber hasil ujian CBT (22 Nov 2026, setelah F12): `exportCbtResults` memakai filter daftar hasil (`packageId`, `passed`), permission `cbt.results.view`, dan App DB aplikasi konteks. Diverifikasi runtime (19 dari 19 cek): job `QUEUED` → `DONE` dengan `rowCount` sama dengan daftar hasil lulus, CSV `ekspor-hasil-cbt-uji-cbt2-*.csv` berisi 12 kolom dengan peserta dan skor yang sama dengan daftar, unduh tanpa sesi 401, job kedua saat job aktif ditolak, dan aplikasi tanpa modul CBT dijawab pesan modul (bukan INTERNAL_ERROR).

Verifikasi tambahan: 41 suite / 413 test hijau; `turbo typecheck lint test build --force` 7 successful 0 cached; migrasi `20261121000001_platform_export_jobs` diterapkan dan struktur tabel dicek `\d`. Tombol Ekspor CMS lulus build/typecheck dan dokumen GraphQL-nya teruji terhadap schema live, tetapi belum di-click-through di browser (engine browser tidak tersedia di server saat verifikasi); logika komponen ditinjau kode.

## Catatan implementasi

Keputusan: batas 50000 baris per ekspor (`EXPORT_MAX_ROWS`), satu job aktif per admin lintas sumber, TTL tautan 24 jam (`EXPORT_TTL_HOURS`), runner in-process pola F10 (interval 5 detik, klaim maks 5 job, tanpa BullMQ), berkas di root storage terpisah (`EXPORT_STORAGE_ROOT`, default `./storage/exports`) sehingga tak tersaji lewat endpoint publik `/media`. Sumber ekspor generik lewat registry `export-sources.ts` yang memakai ulang repository daftar; user aplikasi, log audit, dan hasil ujian CBT sudah terdaftar, sedangkan transaksi POS belum ada modulnya dan tinggal didaftarkan ke registry saat modulnya siap.

## Referensi

- [docs/02-prd.md](../docs/02-prd.md) FR-PLAT-15
