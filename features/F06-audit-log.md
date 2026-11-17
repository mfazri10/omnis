# F06 — Audit Log

| Item | Detail |
|---|---|
| FR | FR-PLAT-08 |
| Fase | 1 |
| Prioritas | Must |
| Status | Selesai |
| Dependensi | F01, F03 |

## Tujuan

Setiap aksi penting tercatat (siapa, kapan, aplikasi apa, apa yang diubah) dan bisa ditelusuri lintas aplikasi.

## Lingkup Backend

- [x] Tabel `activity_logs` (append-only, tanpa hapus/ubah)
- [x] Helper pencatatan terpusat: dipanggil setiap mutation penting (CRUD modul, config, role, provisioning, login)
- [x] Field: aktor, waktu, `app_id` (NULL untuk aksi global), aksi, entitas + ID, ringkasan, IP
- [x] Query `activityLogs` dengan filter (rentang tanggal, aplikasi, aktor, entitas) + pagination

## Lingkup CMS UI

- [x] Layar Audit Log: tabel + filter + pencarian ringkasan
- [ ] Tautan balik ke entitas terkait bila masih ada

## Kriteria Selesai

1. Buat/ubah/hapus/config/role/provisioning/login semuanya tercatat dengan aplikasi dan aktor yang benar.
2. Filter tanggal + aplikasi + aktor mengembalikan hasil yang tepat.
3. Tidak ada jalur (UI maupun API) untuk mengubah/menghapus log.

## Catatan

- Login tercatat lewat `databaseHooks.session.create.after` better-auth yang
  memanggil `onAdminSignedIn` hanya untuk path `/sign-in/email`
  (`apps/api/src/auth/better-auth.ts`, dicatat di `auth.module.ts` dengan
  `action: "login"` dan `app_id` NULL). Mekanisme ini diverifikasi dengan
  membaca source better-auth 1.7.18 (sign-in → `createSession` →
  `createWithHooks`), bukan lewat automated test: tidak ada spec yang
  mencakup jalur login. IP null bila header proxy tidak ada; login yang
  admin-nya tidak aktif/tidak dikenal tidak dicatat.
- `deleteApp` dan `setFcmCredential` sempat tidak tercatat; diperbaiki pada
  tahap UI ini (resolver + `apps-audit.spec.ts`) karena melanggar kriteria 1.
- Tautan balik ke entitas belum dibangun (kolom entitas hanya teks
  `entity_type#entity_id`); kriteria 1–3 tidak mensyaratkannya.

## Referensi

- [docs/03-fitur-dan-modul.md](../docs/03-fitur-dan-modul.md) A6
- [docs/06-database-design.md](../docs/06-database-design.md) `activity_logs`
