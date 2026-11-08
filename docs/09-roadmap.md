# 09 — Roadmap

Scope Fase 1 = **CMS/platform dulu**; mobile menyusul. Estimasi kasar untuk tim kecil (1–2 backend/fullstack + paruh waktu desain/QA).

## Fase 0 — Penguncian & Fondasi (Minggu 1)

- Kunci modul pilot pertama (usulan: Tes CPNS — lihat [10-keputusan-terbuka.md](10-keputusan-terbuka.md)).
- Desain UI CMS: shell + app switcher, layar platform, layar modul pilot.
- Repositori, Docker Compose dev (Postgres, Redis, API, web, worker), CI dasar.
- Akun email transaksional, bucket storage, proyek Firebase.
- **Hasil:** desain disetujui, `docker compose up` jalan, migrasi control-plane awal.

## Fase 1 — Platform Core (Minggu 2–5)

Control-plane + CMS:

- Registry + provisioning aplikasi (satu alur ujung-ke-ujung).
- better-auth admin: login, sesi, reset kata sandi, pencabutan sesi.
- RBAC dinamis: katalog permission, CRUD role + cakupan, penetapan, guard GraphQL.
- Audit log, dashboard global & per aplikasi, remote config per aplikasi.
- User aplikasi, media library (+ `POST /uploads`), kampanye notifikasi + worker BullMQ.
- **Hasil:** kriteria penerimaan 1, 2, 4, 5, 6, 7 di [02-prd.md](02-prd.md) terbukti di staging.

## Fase 2 — Modul Pilot (Minggu 6–8)

- Bangun modul domain pertama + layarnya mengikuti **pola modul baku** (entities, migrasi App DB, resolver + permission, statistik dashboard, mini-PRD final).
- Kriteria penerimaan 3 terbukti; pola modul didokumentasikan sebagai template modul berikutnya.
- **Hasil:** satu aplikasi bisa dioperasikan penuh dari CMS.

## Fase 3 — Modul Berikutnya (per modul ±2–3 minggu)

- Modul aplikasi kedua dan ketiga mengikuti template Fase 2.
- Impor massal (CSV/Excel) bila dibutuhkan; ekspor CSV; pemolesan berdasarkan umpan balik operator.
- **Hasil:** seluruh aplikasi awal (CBT, POS, debat) terkelola di satu CMS.

## Fase 4 — Mobile (setelah CMS stabil)

- Auth app-user (better-auth instance per App DB, token bearer), query `appConfig`, layar maintenance/force update.
- Fondasi mobile bersama (jaringan, sesi, notifikasi, codegen) + aplikasi pertama.
- **Offline-first untuk POS dan CBT** sesuai catatan mini-PRD — dikerjakan sebagai bagian fondasi, bukan tempelan.
- **Hasil:** aplikasi mobile pertama rilis closed testing dengan backend yang sudah matang.

## Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Operasional N database | Migrasi/backup terlewat | Provisioning satu alur; backup membaca daftar DB dari registry; health-check per DB |
| Permission sprawl | Role sulit dipahami | Katalog dikelompokkan per modul; aksi baku (`view/create/update/delete` + sedikit khusus) |
| Email tidak sampai | Reset kata sandi gagal | Siapkan penyedia + domain di Fase 0; uji kirim sebelum butuh |
| Modul baru menyimpang pola | CMS tidak konsisten | Fase 2 menghasilkan template + checklist pola modul baku |
| Upload disalahgunakan | Biaya storage / malware | Batas tipe & ukuran di server; nama acak; bucket privat + URL bertanda bila perlu |

## Definisi Selesai (per fitur / per modul)

1. Berfungsi di staging sesuai kriteria penerimaan; permission ditolak di API, bukan hanya disembunyikan di UI.
2. Migrasi naik-turun bersih untuk DB yang disentuh; provisioning aplikasi baru tetap hijau.
3. Pesan error berbahasa Indonesia dan terbaca manusia.
4. Tidak ada secret/kredensial di repositori.
5. Dokumen terkait diperbarui (termasuk katalog permission modul baru).
