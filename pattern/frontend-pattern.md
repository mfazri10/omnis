# Pattern Frontend — CMS Web Next.js + Apollo

CMS adalah dashboard admin berbahasa Indonesia: app switcher, menu global/konteks, tabel server-paginated, form, dan upload. Acuan: [03-A](../docs/03-fitur-dan-modul.md), [07-api](../docs/07-api-design.md), [F02](../features/F02-kerangka-cms-app-switcher.md).

Stack: Next.js (App Router) + Apollo Client + Tailwind + React Hook Form + Zod + Zustand. Tipe operasi GraphQL di-generate (codegen), bukan ditulis manual.

## 1. Struktur Direktori & Routing Konteks Aplikasi

Slug aplikasi aktif adalah **bagian dari URL** agar bisa di-bookmark dan di-share: `/tes-cpns/questions`, `/ngewarung/products`.

```text
apps/cms/
├── app/
│   ├── (auth)/                 # Tanpa shell: login, forgot-password, reset-password
│   ├── (shell)/
│   │   ├── layout.tsx          # Shell: sidebar + header + app switcher
│   │   ├── platform/           # Menu GLOBAL: apps, admins, roles, audit-log
│   │   │   ├── apps/page.tsx   # + [slug]/page.tsx (detail aplikasi)
│   │   │   ├── admins/..., roles/..., audit-log/...
│   │   └── [appSlug]/          # Menu KONTEKS aplikasi (F02)
│   │       ├── layout.tsx      # Validasi slug vs hak admin; 403 bila tak berhak
│   │       ├── page.tsx        # Dashboard aplikasi (F07)
│   │       ├── users/...       # F08
│   │       ├── media/...       # F09
│   │       ├── campaigns/...   # F10
│   │       ├── settings/...    # Remote config (F04)
│   │       └── questions/...   # Modul domain (F12) — rute per modul
│   └── layout.tsx              # Root: Apollo provider, toaster, theme
├── components/
│   ├── ui/                     # Primitif desain (Button, Input, Card, Dialog, Table)
│   └── shared/                 # AppSwitcher, Sidebar, DataTable, EmptyState, ErrorView
├── features/<area>/            # Satu folder per area: auth, apps, roles,
│   ├── components/             # users, media, campaigns, questions, ...
│   ├── hooks/                  # questions/ (modul) mengikuti pola yang sama
│   ├── graphql/                # Dokumen operasi (*.graphql.ts) area ini
│   └── schemas.ts              # Skema Zod form area ini
├── lib/
│   ├── apollo-client.ts        # credentials:include + header X-App-Slug dinamis
│   ├── auth-client.ts          # better-auth client (baseURL = API)
│   └── graphql-codegen.ts      # Konfigurasi codegen (tipe hasil di lib/__generated__/)
├── stores/
│   └── use-session-store.ts    # Zustand: admin, accessibleApps, permissions, sidebar
├── middleware.ts               # Lindungi /(shell)*: tanpa sesi → /login
└── utils/                      # cn(), formatTanggal, formatRupiah (murni)
```

**Aturan pokok:**

- `app/` hanya routing + layout; logika & dokumen GraphQL di `features/<area>/`.
- Halaman konteks selalu membaca slug dari route (`params.appSlug`), **bukan** dari state global — state hanya untuk switcher & permission.
- Pindah aplikasi = navigasi ke route slug lain (bukan sekadar ganti header).

## 2. Apollo Client & Codegen

```typescript
// lib/apollo-client.ts — prinsipnya (bukan seluruh kode):
// - HttpLink ke API_URL/graphql dengan credentials: 'include' (cookie sesi)
// - Middleware link menyisipkan X-App-Slug dari route aktif
// - Error link memetakan extensions.code (bagian 6)
```

- Semua operasi lewat dokumen ter-generate: `useQuestionsQuery`, `usePublishQuestionMutation` — dilarang menulis `gql` inline di komponen.
- Jalankan codegen setiap skema berubah; CI gagal bila hasil generate tidak sinkron dengan skema (mencegah drift).

## 3. Auth, Middleware & PermissionGate

- Login/logout/reset memakai better-auth client ke API (`/api/auth/*`); sesi berupa cookie httpOnly — frontend tidak menyimpan token.
- `middleware.ts`: `/login` dkk. terbuka; seluruh `/(shell)` butuh sesi; route `/platform/*` butuh hak global (cek ringan di middleware, penegakan final tetap di API).
- Layout `[appSlug]`: validasi slug terhadap `accessibleApps` di store → slug asing/tak berhak = halaman 403, bukan redirect diam-diam.

```tsx
// components/shared/permission-gate.tsx
<PermissionGate permission="cbt.questions.publish">
  <Button>Terbitkan</Button>
</PermissionGate>
// - permission dicek terhadap store (diisi dari query permission efektif, F02)
// - Gate hanya menyembunyikan UI; API tetap penegak (doc 04)
```

Sidebar/menu juga dirender dari permission efektif — satu sumber (`stores/use-session-store.ts`) untuk menu dan gate.

## 4. Tabel, Form, Upload

- **Tabel:** komponen `DataTable` bersama — pagination server (`skip/take` + `totalCount`), loading skeleton, empty state jujur ("Belum ada data"), pencarian & filter sebagai argumen query.
- **Form:** React Hook Form + `zodResolver(schemas.ts)`; error validasi server (`BAD_USER_INPUT.fields`) dipetakan ke field form; tombol submit disable saat mutation berjalan.
- **Upload:** `fetch` multipart ke `POST /uploads` (bukan GraphQL) dengan cookie + slug; pakai komponen pemilih media bersama (F09) di semua form yang butuh gambar.

## 5. Server vs Client Component

Dashboard admin ini sangat interaktif — sikapnya pragmatis:

- **Server Component:** root layout, metadata, shell statis.
- **Client Component:** semua halaman data, tabel, form, switcher (butuh Apollo hooks + zustand).
- Jangan mem-fetch data di `useEffect` bila bisa lewat Apollo hooks; jangan simpan data server di zustand (zustand hanya sesi + UI state).

## 6. Penanganan Error Global

Error link Apollo memetakan `extensions.code` (doc 07) secara konsisten:

| `code` | Perilaku CMS |
|---|---|
| `UNAUTHENTICATED` | Redirect ke `/login` dengan pesan "Sesi habis, silakan masuk kembali" |
| `FORBIDDEN` | Halaman 403 ("Anda tidak memiliki akses") — jangan redirect diam-diam |
| `APP_NOT_FOUND` / `APP_SUSPENDED` | Kembali ke pemilih aplikasi + toast penjelasan |
| `BAD_USER_INPUT` | Petakan `extensions.fields` ke field form; fallback ke toast |
| Lainnya / jaringan | Toast "Terjadi kesalahan, coba lagi" + tombol muat ulang pada ErrorView |

## 7. Kebersihan & Konvensi

- `strict: true`, tanpa `any`; props memakai `interface ...Props`; return type eksplisit pada hooks.
- File komponen `PascalCase.tsx`, hooks `useNama.ts`, route mengikuti App Router.
- String UI Bahasa Indonesia inline (tanpa library i18n di v1).
- Tidak ada URL/secret hardcode; hanya via env (`NEXT_PUBLIC_API_URL` untuk API publik).
