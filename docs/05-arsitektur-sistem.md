# 05 — Arsitektur Sistem

## 1. Gambaran Umum

Backend NestJS tunggal yang modular, melayani CMS web lewat GraphQL. Data terpisah tegas: **control-plane DB** untuk lintas aplikasi, **satu App DB per aplikasi** untuk data domain.

```text
                        +------------------- CMS (Web) -------------------+
                        | Shell + App Switcher + Menu global/konteks      |
                        +-----------+------------+------------+-----------+
                        | GraphQL / HTTPS (sesi cookie better-auth)       |
                        | Header X-App-Slug = konteks aplikasi aktif      |
               +--------v-------------------------------------------------+
               |                    Backend NestJS                        |
               |  PlatformModule: apps, auth, rbac, audit, media, notif   |
               |  CbtModule   PosModule   DebatModule  (pola modul baku)  |
               +--+---------------+--------------+------------+-----------+
                  |               |              |            |
        +---------v-+  +----------v--+  +--------v---+  +-----v------+
        | Control   |  | App DB      |  | App DB     |  | App DB     |
        | plane DB  |  | tes-cpns    |  | ngewarung  |  | debat      |
        +-----------+  +-------------+  +------------+  +------------+
                  |                                            |
        +---------v-+                                   +------v-------+
        | Redis +   |                                   | Object       |
        | BullMQ    |                                   | Storage (S3) |
        | (antrian) |                                   | prefix/app   |
        +-----------+                                   +--------------+
                  |
        +---------v----------------------+
        | FCM (kredensial per aplikasi)  |
        | Email transaksional (reset/    |
        | verifikasi better-auth)        |
        +--------------------------------+
```

## 2. Kepemilikan Data (Aturan Baku)

| Data | Tinggal di | Alasan |
|---|---|---|
| Registry aplikasi, config per aplikasi | Control-plane | Operasional platform; dibaca sebelum App DB dipilih |
| Identitas & profil admin, role, permission, penetapan | Control-plane | Lintas aplikasi |
| Audit log (dengan kolom `app_id`) | Control-plane | Audit lintas aplikasi dalam satu tempat |
| Kampanye notifikasi + agregat hasil | Control-plane | Dijadwalkan dari CMS; kredensial FCM per aplikasi dari registry |
| User aplikasi, device token, media metadata | App DB | Data milik aplikasi |
| Seluruh tabel domain (soal, produk, mosi…) | App DB | Isolasi penuh |

## 3. Modul NestJS

| Modul | Tanggung jawab | Database |
|---|---|---|
| `PlatformModule` | Apps, provisioning, config, admin, RBAC, audit, dashboard | Control-plane |
| `MediaModule` | Metadata media + URL upload | App DB konteks (file di storage prefix aplikasi) |
| `NotificationModule` | Kampanye + worker pengiriman | Control-plane (baca token dari App DB saat kirim) |
| `CbtModule`, `PosModule`, `DebatModule` | Domain per aplikasi + katalog permission + statistik dashboard | App DB masing-masing |
| `DatabaseModule` | Connection factory: control-plane (tetap) + App DB lazy pool dinamis per slug (lihat [11-connection-pooling.md](11-connection-pooling.md)) | — |

Pola modul baku (wajib untuk setiap modul domain baru): entities + migrasi App DB, resolver app-scoped + guard permission, pendaftaran katalog permission, seeder config/dashboard statistik, dan dokumen mini-PRD.

## 4. Alur Utama

### 4.1 Request app-scoped (semua operasi dalam konteks aplikasi)

```text
CMS → GraphQL + cookie sesi + X-App-Slug: tes-cpns
API → verifikasi sesi (better-auth) → admin aktif?
    → slug valid & tidak suspended? → admin punya hak pada aplikasi itu?
    → pilih koneksi App DB tes-cpns (lazy pool) → guard cek permission operasi (Redis cached, lihat [14-caching-strategy.md](14-caching-strategy.md))
    → resolver jalan → tulis audit log
```

### 4.2 Provisioning aplikasi baru

```text
Super Admin → mutation provisionApp(nama, slug)
API → validasi slug unik → CREATE DATABASE app_<slug>
    → jalankan migrasi template (users, media, device_tokens)
    → migrasi modul domain bila dipilih → isi registry + config awal
    → audit log. Gagal di tengah → alur kompensasi saga (DROP DB, hapus registry — lihat [13-provisioning-saga.md](13-provisioning-saga.md))

### 4.3 Login admin

```text
CMS → better-auth sign-in (email + kata sandi) → cookie sesi httpOnly
Setiap request → sesi valid? → profil admin aktif?
Logout / nonaktifkan admin → sesi dicabut
```

better-auth hidup sebagai instance pada control-plane DB untuk identitas admin. Instance per App DB untuk user aplikasi disiapkan polanya di fase mobile (token bearer untuk mobile, bukan cookie).

### 4.4 Kampanye notifikasi terjadwal

```text
Admin → buat kampanye (status scheduled) → tersimpan di control-plane
Worker BullMQ → saat waktunya: ambil token dari App DB target
             → kirim via FCM (kredensial aplikasi itu dari registry)
             → tulis agregat hasil → bersihkan token basi
```

### 4.5 Upload media

```text
CMS → POST /uploads (multipart, cookie sesi + X-App-Slug)
API → cek permission platform.media.create dalam cakupan
    → validasi tipe & ukuran → simpan ke storage prefix {slug}/
    → tulis metadata ke App DB → kembalikan record media
```

## 5. Keamanan

| Lapisan | Penerapan |
|---|---|
| Transport | HTTPS wajib; cookie sesi `httpOnly` + `secure` + `sameSite` |
| Identitas | better-auth: hash kata sandi, verifikasi email, reset bertoken kedaluwarsa |
| Otorisasi | Guard permission per operasi (desain di [04-user-role-permission.md](04-user-role-permission.md)); Super Admin flag global |
| Isolasi | Koneksi App DB dipilih server dari slug tervalidasi; tidak ada query lintas App DB dari resolver domain |
| Input | Validasi DTO di semua mutation; query terparameter via ORM |
| Rate limit | Sign-in, lupa kata sandi, dan upload dibatasi (lihat detail di [16-operasional-teknis.md](16-operasional-teknis.md)) |
| Rahasia | Kredensial FCM terenkripsi di registry; secret hanya di environment server |
| GraphQL | Kompleksitas/kedalaman query dibatasi; playground & introspeksi mati di produksi |

## 6. Lingkungan & Deployment Fase 1

| Lingkungan | Isi |
|---|---|
| Development | Docker Compose: Postgres (multi-DB), Redis, API NestJS, CMS web, worker |
| Staging | Mirror produksi; data uji |
| Production | Sama + backup harian semua DB (retensi ≥ 7 hari), log terpusat, health-check |

Satu server Postgres menampung control-plane DB + semua App DB di Fase 1; pemisahan server per DB besar dimungkinkan belakangan tanpa mengubah kode (connection string per aplikasi).

## 7. Keputusan Arsitektur (ringkasan)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Isolasi antar aplikasi | Multi-database | Domain & user murni terpisah; blast radius kecil |
| Gaya API | GraphQL code-first | Satu endpoint untuk CMS bervariasi + mobile nanti; typing end-to-end |
| Upload file | REST terpisah | GraphQL tidak cocok untuk multipart |
| Auth admin | better-auth (sesi cookie) | Self-hosted, email+password, tanpa vendor lock-in |
| Antrian | Redis + BullMQ | Notifikasi terjadwal yang andal |
| Pola backend | Monolit modular | Satu deploy; modul domain terpisah rapi per App DB |
| Connection pooling | Lazy pool + idle eviction (PgBouncer bila >30 app) | Hemat resource koneksi Postgres (lihat [11-connection-pooling.md](11-connection-pooling.md)) |
| Migrasi multi-DB | Registry `schema_migrations` per DB + CLI runner | Menjamin seluruh App DB konsisten (lihat [12-migration-strategy.md](12-migration-strategy.md)) |
| Provisioning | Saga + compensation stack + advisory lock | Atomisitas aman meski `CREATE DATABASE` non-transaksional (lihat [13-provisioning-saga.md](13-provisioning-saga.md)) |
| Caching | Redis multi-layer (admin, apps, permissions) | Minimalkan query control-plane per request (lihat [14-caching-strategy.md](14-caching-strategy.md)) |
