# 07 — Desain API (GraphQL)

Satu endpoint GraphQL untuk CMS (dan kelak mobile). Skema code-first dari NestJS; CMS tidak mengakses database langsung.

## 1. Konvensi Umum

| Aspek | Kesepakatan |
|---|---|
| Endpoint | `POST /graphql` (query + mutation); `GET /graphql` hanya playground non-produksi |
| Auth CMS | Cookie sesi better-auth (`httpOnly`, `secure`, `sameSite`) |
| Konteks aplikasi | Header `X-App-Slug`; wajib untuk operasi app-scoped, diabaikan untuk operasi global |
| Penamaan tipe | PascalCase (`Question`, `Campaign`); field/argumen camelCase |
| Pagination daftar admin | Argumen `skip`/`take` (default/maks `take: 50`) + `totalCount` pada tipe koneksi `{ items, totalCount }` |
| Bahasa pesan | Bahasa Indonesia untuk pesan yang tampil ke pengguna |
| Upload file | **Bukan** GraphQL — `POST /uploads` REST (lihat bagian 5) |
| Subscription | Disediakan belakangan (fase realtime debat/dll.); skema disiapkan |

### Konteks server (`ctx`)

Setiap request membangun: `admin` (dari sesi + profil aktif?) dan `app` (dari slug tervalidasi + hak admin). Resolver app-scoped menerima koneksi App DB yang sudah dipilih server.

### Format error

GraphQL `errors[]` dengan `extensions.code` yang stabil untuk ditangani CMS:

| `code` | Arti |
|---|---|
| `UNAUTHENTICATED` | Sesi tidak valid / admin nonaktif |
| `FORBIDDEN` | Permission tidak cukup (beserta `requiredPermission`) |
| `APP_NOT_FOUND` / `APP_SUSPENDED` | Slug salah atau aplikasi di-suspend |
| `BAD_USER_INPUT` | Validasi gagal (detail per field di `extensions.fields`) |
| `NOT_FOUND` | Data tidak ditemukan |

## 2. Operasi Global (Super Admin / permission `platform.*`)

```graphql
# Aplikasi
query apps { items totalCount }
query app(slug: String!)
mutation createApp(input: CreateAppInput!)        # registry saja
mutation provisionApp(input: ProvisionAppInput!)  # registry + DB + migrasi + config
mutation suspendApp / archiveApp / updateApp

# Admin, role, permission
query admins(skip:take:search:) / admin(id:) / currentAdmin
mutation createAdmin / updateAdmin / setAdminActive
query roles(scope: appId:) / permissions(module:)
mutation createRole / updateRole / deleteRole
mutation assignRole(adminId: roleId: appId:) / unassignRole
query effectivePermissions(adminId: appId:) / adminAssignments(adminId:)

# Audit & dashboard global
query activityLogs(appId: adminId: from: to:)
query platformDashboard
```

## 3. Operasi App-Scoped (wajib `X-App-Slug` + permission)

```graphql
# Config & dashboard aplikasi
query appConfig            # maintenance, versi minimum, tema, kontak
mutation updateAppConfig   # platform.app-config.manage
query appDashboard         # statistik modul + aktivitas terakhir

# User aplikasi
query appUsers(search: status: skip: take:)
mutation setAppUserActive  # platform.users.manage

# Media
query media(search: skip: take:)
mutation deleteMedia
# upload via POST /uploads (bagian 5)

# Notifikasi
query campaigns(status: skip: take:) / campaign(id:)
mutation createCampaign / updateCampaign / cancelCampaign
mutation sendCampaignNow   # platform.notifications.send
```

Operasi domain per modul didefinisikan dalam dokumen modul masing-masing saat fasenya dimulai:

- CBT: query/mutation soal, paket, sesi, hasil.
- POS: query/mutation outlet, produk, stok, transaksi, laporan.
- Debat: query/mutation mosi, argumen, voting, laporan.

## 4. Contoh Alur

### CMS memuat daftar soal (konteks `tes-cpns`)

```http
POST /graphql
Cookie: better-auth.session=...
X-App-Slug: tes-cpns
```

```graphql
query ($take: Int = 20, $skip: Int = 0, $category: QuestionCategory) {
  questions(take: $take, skip: $skip, category: $category) {
    totalCount
    items { id category stem status updatedAt }
  }
}
```

Server: sesi valid? → slug `tes-cpns` aktif & boleh diakses? → permission `cbt.questions.view` dalam cakupan? → query ke `app_tes_cpns`.

### Penolakan permission

```json
{ "errors": [{ "message": "Anda tidak memiliki akses untuk tindakan ini",
  "extensions": { "code": "FORBIDDEN", "requiredPermission": "cbt.questions.publish" } }] }
```

## 5. Upload Media — `POST /uploads`

Multipart `multipart/form-data`: cookie sesi + `X-App-Slug` + field `file` (+ `altText` opsional). Server cek `platform.media.create` dalam cakupan, validasi tipe/ukuran, simpan ke storage prefix `{slug}/`, tulis metadata ke App DB, kembalikan record `Media`. Batas default: gambar 5 MB; tipe: jpg/png/webp/pdf (dikonfigurasi).

## 6. Keamanan & Batas API

- Rate limit: sign-in, lupa kata sandi, dan `/uploads`.
- Batas kompleksitas & kedalaman query; `take` maksimum 50 (daftar admin) — ekspor massal lewat job CSV, bukan query raksasa.
- Introspeksi + playground mati di produksi.
- Kredensial FCM dan secret tidak pernah muncul di skema GraphQL.
