# 17 — ERD (Entity Relationship Diagram)

Diagram database platform: control-plane + template App DB. Satu sumber kebenaran skema tetap [06-database-design.md](06-database-design.md) — dokumen ini adalah visualisasinya.

> Cara melihat: GitHub me-render blok `mermaid` otomatis. Di VS Code, pakai extension Mermaid preview. Atau tempel ke [mermaid.live](https://mermaid.live).

Konvensi diagram (dari doc 06, tidak digambar agar ringkas): semua tabel memakai PK `id bigint`, kolom `created_at`/`updated_at`, dan soft delete via `deleted_at` — kecuali `activity_logs` (append-only) dan tabel better-auth (dikelola library).

## 1. Control-Plane DB (`platform`)

```mermaid
erDiagram
    %% ── REGISTRY & CONFIG ──
    apps {
        bigint id PK
        varchar name
        varchar slug UK
        varchar icon_media_url "nullable"
        varchar status "active|suspended|archived"
        varchar db_name
        varchar android_package "nullable"
        varchar ios_bundle_id "nullable"
        varchar store_url_android "nullable"
        varchar store_url_ios "nullable"
        text fcm_credential "nullable, terenkripsi"
        text notes "nullable"
    }

    app_configs {
        bigint app_id PK "FK → apps.id, satu baris per aplikasi"
        boolean maintenance_mode
        text maintenance_message "nullable"
        varchar min_version_android
        varchar min_version_ios
        varchar theme_primary_color
        varchar logo_media_url "nullable"
        varchar support_email "nullable"
        varchar support_whatsapp "nullable"
    }

    %% ── ADMIN & RBAC ──
    admins {
        bigint id PK
        varchar auth_user_id UK "→ user.id (better-auth)"
        varchar name
        varchar email UK
        boolean is_super_admin
        boolean is_active
        timestamp last_login_at "nullable"
    }

    roles {
        bigint id PK
        varchar name
        varchar description "nullable"
        varchar scope_type "global|app"
        bigint app_id FK "nullable, wajib bila scope=app"
    }

    permissions {
        bigint id PK
        varchar key UK "modul.entitas.aksi"
        varchar module
        varchar label
        varchar description "nullable"
    }

    role_permissions {
        bigint role_id PK "FK → roles.id"
        bigint permission_id PK "FK → permissions.id"
    }

    admin_role_assignments {
        bigint admin_id PK "FK → admins.id"
        bigint role_id PK "FK → roles.id"
        bigint app_id PK "FK → apps.id, nullable utk role global"
    }

    %% ── AUDIT & NOTIFIKASI ──
    activity_logs {
        bigint id PK
        bigint admin_id FK
        bigint app_id FK "nullable = aksi global"
        varchar action
        varchar entity_type
        varchar entity_id "teks (ID lintas DB)"
        text summary "nullable"
        varchar ip_address "nullable"
    }

    notification_campaigns {
        bigint id PK
        bigint app_id FK
        bigint created_by FK "→ admins.id"
        varchar title
        text body
        varchar image_url "nullable"
        varchar link_target "nullable"
        varchar target_type "all|segment"
        jsonb target_segment "nullable"
        varchar status "draft|scheduled|sending|sent|failed|cancelled"
        timestamp scheduled_at "nullable"
        timestamp sent_at "nullable"
        int target_count
        int sent_count
        int failed_count
    }

    %% ── BETTER-AUTH (dikelola library) ──
    user {
        varchar id PK
        varchar name
        varchar email UK
        boolean emailVerified
        varchar image "nullable"
    }

    session {
        varchar id PK
        varchar userId FK
        varchar token UK
        timestamp expiresAt
        varchar ipAddress "nullable"
        varchar userAgent "nullable"
    }

    account {
        varchar id PK
        varchar userId FK
        varchar accountId
        varchar providerId "credential|google|..."
    }

    verification {
        varchar id PK
        varchar identifier
        varchar value
        timestamp expiresAt
    }

    %% ── RELASI ──
    apps ||--|| app_configs : "memiliki config"
    apps ||--o{ roles : "cakupan role app"
    apps ||--o{ admin_role_assignments : "cakupan penetapan"
    apps ||--o{ activity_logs : "konteks"
    apps ||--o{ notification_campaigns : "target kampanye"

    admins ||--o{ admin_role_assignments : "memegang role"
    roles ||--o{ admin_role_assignments : "diberikan"
    roles ||--o{ role_permissions : "tersusun dari"
    permissions ||--o{ role_permissions : "termasuk dalam"

    admins ||--o{ activity_logs : "pelaku"
    admins ||--o{ notification_campaigns : "pembuat"

    user ||--o{ admins : "identitas"
    user ||--o{ session : "memiliki"
    user ||--o{ account : "memiliki"
```

Catatan:

- `admins.auth_user_id → user.id` adalah tautan logis identitas-profil (satu profil per identitas).
- Kolom better-auth mengikuti versi library yang dipakai; yang digambar adalah kolom inti.
- Kolom tambahan dari doc 13 (`apps.status` = `provisioning`/`failed`, `failure_reason`, `last_provisioning_at`) **belum** masuk diagram — menunggu rekonsiliasi saga (temuan audit).

## 2. Template App DB (`app_{slug}`)

Dibuat identik untuk setiap aplikasi saat provisioning, lalu ditambah tabel domain modulnya di Fase 2.

```mermaid
erDiagram
    users {
        bigint id PK
        varchar name
        varchar email UK "nullable"
        varchar phone UK "nullable"
        varchar avatar_url "nullable"
        boolean is_active
        jsonb metadata "nullable"
        timestamp last_login_at "nullable"
    }

    media {
        bigint id PK
        bigint uploaded_by_admin_id "logis → admins.id (control-plane)"
        varchar file_name
        varchar path "prefix {slug}/"
        varchar url
        varchar mime_type
        bigint size_bytes
        varchar alt_text "nullable"
    }

    device_tokens {
        bigint id PK
        bigint user_id FK "nullable = perangkat tamu"
        varchar token UK
        varchar platform "android|ios"
        varchar app_version "nullable"
        timestamp last_seen_at
    }

    users ||--o{ device_tokens : "perangkat"
```

Catatan:

- `media.uploaded_by_admin_id` adalah referensi **logis** ke `admins.id` di control-plane — bukan foreign key (tidak ada FK lintas database, doc 06).
- Tabel domain modul (soal, produk, mosi, ...) didefinisikan di dokumen modul saat Fase 2; semuanya FK ke `users`/`media` skema ini bila perlu.

## 3. Tautan Logis Lintas Database (tanpa FK)

| Dari | Ke | Keterangan |
|---|---|---|
| `admins.id` (platform) | `media.uploaded_by_admin_id` (app) | Pengunggah file |
| `admins.id` (platform) | konteks App DB mana pun | Aktor yang tercatat di `activity_logs` |
| `apps.db_name` (platform) | database `app_{slug}` | Dipakai connection factory (doc 11), bukan relasi SQL |
| `activity_logs.entity_id` (platform) | baris di App DB | ID disimpan sebagai teks + `entity_type` |

## 4. Referensi

- [06-database-design.md](06-database-design.md) — definisi kolom, indeks, operasional backup
- [11-connection-pooling.md](11-connection-pooling.md) — cara backend memilih database per request
- [12-migration-strategy.md](12-migration-strategy.md) — `schema_migrations` per database (tabel operasional, tidak digambar)
- [16-operasional-teknis.md](16-operasional-teknis.md) — kebijakan soft/hard delete per tabel
