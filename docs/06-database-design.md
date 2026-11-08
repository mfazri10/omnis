# 06 — Desain Database

PostgreSQL. Satu server menampung **control-plane DB** (`platform`) + **satu App DB per aplikasi** (`app_tes_cpns`, `app_ngewarung`, `app_debat`, …). Konvensi: tabel `snake_case` plural, kolom `snake_case`, PK `id bigint` auto-increment, `created_at`/`updated_at` di semua tabel, soft delete via `deleted_at` kecuali dinyatakan lain. Tidak ada foreign key lintas database — relasi ke aplikasi lain hanya berupa `app_id`/`slug` logis.

## 1. Peta Database

```text
platform (control-plane)
  apps, app_configs, admins, roles, permissions,
  role_permissions, admin_role_assignments,
  activity_logs, notification_campaigns
  + tabel better-auth (user, session, account, verification)

app_{slug} (tiap aplikasi — template + domain)
  users, media, device_tokens
  + tabel domain modul (lihat mini-PRD 11–13)
```

## 2. Control-Plane DB (`platform`)

### `apps` (registry)

| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| name | varchar | Nama tampil, mis. "Tes CPNS" |
| slug | varchar UNIQUE | `tes-cpns`; dipakai di header konteks & prefix storage |
| icon_media_url | varchar NULL | URL file di prefix `platform/` |
| status | enum | `active`, `suspended`, `archived` |
| db_name | varchar | `app_tes_cpns` |
| android_package | varchar NULL | Mis. `id.or.app.tescpns` |
| ios_bundle_id | varchar NULL | |
| store_url_android / store_url_ios | varchar NULL | |
| fcm_credential | text NULL | Service account JSON **terenkripsi** |
| notes | text NULL | |

### `app_configs` (satu baris per aplikasi)

| Kolom | Tipe | Catatan |
|---|---|---|
| app_id | FK → apps UNIQUE | |
| maintenance_mode | boolean | |
| maintenance_message | text NULL | |
| min_version_android / min_version_ios | varchar | Force update |
| theme_primary_color | varchar | Hex |
| logo_media_url | varchar NULL | Prefix `platform/` |
| support_email / support_whatsapp | varchar NULL | |

### `admins` (profil; identitas di tabel better-auth `user`)

| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| auth_user_id | varchar UNIQUE | ID baris better-auth `user` |
| name | varchar | |
| email | varchar UNIQUE | Duplikat terkendali untuk pencarian cepat |
| is_super_admin | boolean | |
| is_active | boolean | Nonaktif = akses ditolak + sesi dicabut |
| last_login_at | timestamp NULL | |

### `roles`, `permissions`, `role_permissions`, `admin_role_assignments`

`roles`: `id`, `name` ("Editor Soal"), `description`, `scope_type` enum (`global`,`app`), `app_id` FK NULL (wajib bila scope `app`).

`permissions`: `id`, `key` UNIQUE (`cbt.questions.publish`), `module` (`cbt`), `label` ("Menerbitkan soal"), `description`. Di-seed dari katalog tiap modul; tidak dibuat manual.

`role_permissions`: pasangan `role_id` + `permission_id` (PK gabungan).

`admin_role_assignments`: `admin_id` FK, `role_id` FK, `app_id` FK NULL — untuk role scope `app`, `app_id` wajib dan harus sama dengan `app_id` role. PK gabungan ketiganya.

### `activity_logs`

| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| admin_id | FK → admins | Pelaku |
| app_id | FK → apps NULL | NULL = aksi global (registry, role) |
| action | varchar | `create`, `update`, `delete`, `publish`, `login`, `provision`, … |
| entity_type / entity_id | varchar / varchar | `cbt_question`, `42` — ID lintas DB disimpan sebagai teks |
| summary | text | Ringkasan terbaca manusia |
| ip_address | varchar NULL | |

Tanpa `deleted_at` (append-only); retensi ≥ 1 tahun.

### `notification_campaigns`

| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| app_id | FK → apps | |
| created_by | FK → admins | |
| title / body | varchar / text | |
| image_url | varchar NULL | |
| link_target | varchar NULL | Rute tujuan di aplikasi (dipakai fase mobile) |
| target_type | enum | `all`, `segment` |
| target_segment | jsonb NULL | Kriteria segmen sederhana |
| status | enum | `draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled` |
| scheduled_at / sent_at | timestamp NULL | |
| target_count / sent_count / failed_count | int | Agregat hasil |

### Tabel better-auth (control-plane, identitas admin)

better-auth mengelola skemanya sendiri (`user`, `session`, `account`, `verification`) dengan adapter database yang sama. `admins.auth_user_id` menunjuk ke `user.id`. Fase mobile menambahkan instance better-auth per App DB untuk user aplikasi (pola sama, database berbeda).

## 3. Template App DB (`app_{slug}`)

Dibuat saat provisioning; migrasi template + migrasi modul domain.

### `users` (user aplikasi — terpisah per aplikasi)

| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| name | varchar | |
| email | varchar UNIQUE NULL | |
| phone | varchar UNIQUE NULL | |
| avatar_url | varchar NULL | |
| is_active | boolean | Nonaktif = tidak bisa login (fase mobile) |
| metadata | jsonb NULL | Atribut khusus aplikasi (mis. outlet kasir) |
| last_login_at | timestamp NULL | |

Kolom kredensial (`password_hash` better-auth `account`, dsb.) ditambahkan saat fase mobile, bukan Fase 1.

### `media`

| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| uploaded_by_admin_id | bigint NULL | ID admin control-plane (logis, bukan FK) |
| file_name / path / url | varchar | `path` = `{slug}/...` di object storage |
| mime_type / size_bytes | varchar / bigint | |
| alt_text | varchar NULL | |

### `device_tokens` (diisi fase mobile; dibaca worker notifikasi)

| Kolom | Tipe | Catatan |
|---|---|---|
| id | bigint PK | |
| user_id | FK → users NULL | NULL untuk perangkat tamu |
| token | varchar UNIQUE | Token FCM |
| platform | enum | `android`, `ios` |
| app_version | varchar NULL | |
| last_seen_at | timestamp | Token basi dibersihkan worker |

## 4. Tabel Domain per Aplikasi

Didefinisikan dalam dokumen modul masing-masing saat fasenya dimulai (satu sumber kebenaran, tidak diduplikasi di sini). Entitas intinya:

- Tes CPNS: bank soal, paket, sesi, hasil.
- Ngewarung: outlet, produk, stok, transaksi.
- Debat: mosi, argumen, voting.

## 5. Indeks & Operasional

- Indeks: `apps.slug`, `admins.email`, `permissions.key`, `activity_logs(app_id, created_at)`, `notification_campaigns(app_id, status, scheduled_at)`, `users.email`, `device_tokens.token`.
- Migrasi teregistrasi per database: control-plane sekali; tiap App DB = migrasi template + migrasi modulnya. Provisioning menjalankan semuanya dalam satu transaksi alur (lihat [05-arsitektur-sistem.md](05-arsitektur-sistem.md)).
- Backup harian mencakup `platform` + seluruh `app_*`; daftar DB diambil dari registry agar aplikasi baru otomatis tercakup.
