# F06 — Audit Log

| Item | Detail |
|---|---|
| FR | FR-PLAT-08 |
| Fase | 1 |
| Prioritas | Must |
| Status | Belum mulai |
| Dependensi | F01, F03 |

## Tujuan

Setiap aksi penting tercatat (siapa, kapan, aplikasi apa, apa yang diubah) dan bisa ditelusuri lintas aplikasi.

## Lingkup Backend

- [ ] Tabel `activity_logs` (append-only, tanpa hapus/ubah)
- [ ] Helper pencatatan terpusat: dipanggil setiap mutation penting (CRUD modul, config, role, provisioning, login)
- [ ] Field: aktor, waktu, `app_id` (NULL untuk aksi global), aksi, entitas + ID, ringkasan, IP
- [ ] Query `activityLogs` dengan filter (rentang tanggal, aplikasi, aktor, entitas) + pagination

## Lingkup CMS UI

- [ ] Layar Audit Log: tabel + filter + pencarian ringkasan
- [ ] Tautan balik ke entitas terkait bila masih ada

## Kriteria Selesai

1. Buat/ubah/hapus/config/role/provisioning/login semuanya tercatat dengan aplikasi dan aktor yang benar.
2. Filter tanggal + aplikasi + aktor mengembalikan hasil yang tepat.
3. Tidak ada jalur (UI maupun API) untuk mengubah/menghapus log.

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A6
- [docs/06-database-design.md](../docs/06-database-design.md) `activity_logs`
