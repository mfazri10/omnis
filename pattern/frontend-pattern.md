# Pattern Frontend — CMS Web Next.js + Apollo

CMS adalah dashboard admin berbahasa Indonesia: app switcher, menu global/konteks, tabel server-paginated, form, dan upload. Acuan: [03-A](../docs/03-fitur-dan-modul.md), [07-api](../docs/07-api-design.md), [F02](../features/F02-kerangka-cms-app-switcher.md).

Stack CMS saat ini memakai Next.js App Router, Apollo Client, Zustand, Tailwind v4, serta shadcn/ui dengan Base UI. Dokumen dan tipe operasi GraphQL tinggal di masing-masing fitur.

## 1. Struktur Direktori & Routing Konteks Aplikasi

Slug aplikasi aktif adalah **bagian dari URL** agar bisa di-bookmark dan di-share: `/tes-cpns/questions`, `/ngewarung/products`.

```text
apps/cms/
├── app/
│   ├── (public)/               # Landing di /, tanpa sesi CMS
│   ├── (auth)/                 # Tanpa shell: login, forgot-password, reset-password
│   ├── (shell)/
│   │   ├── layout.tsx          # Apollo, toaster, sesi, sidebar, header dan pemilih
│   │   ├── platform/           # Pemilih /platform/pilih-aplikasi dan pengelolaan global
│   │   │   ├── apps/page.tsx   # + [slug]/page.tsx (detail aplikasi)
│   │   │   ├── admins/..., roles/..., audit/...
│   │   └── [appSlug]/          # Menu KONTEKS aplikasi (F02)
│   │       ├── layout.tsx      # Validasi slug vs hak admin; 403 bila tak berhak
│   │       ├── page.tsx        # Dashboard aplikasi (F07)
│   │       ├── users/...       # F08
│   │       ├── media/...       # F09
│   │       ├── notifications/  # F10
│   │       ├── settings/...    # Remote config (F04)
│   │       └── cbt/...         # Modul domain (F12)
│   └── layout.tsx              # Bahasa, metadata dasar, dan tema
├── components/
│   ├── ui/                     # Primitif shadcn/ui (Button, Input, Card, Dialog, Table)
│   └── shared/                 # AppSwitcher, CmsSidebar, PageHeader, DataTable, page state
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
├── proxy.ts                    # Lindungi /(shell)*: tanpa sesi → /login (konvensi Next 16)
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

## 3. Auth, Proxy & PermissionGate

- Login/logout/reset memakai better-auth client ke API (`/api/auth/*`); sesi berupa cookie httpOnly — frontend tidak menyimpan token.
- `proxy.ts` mengizinkan landing tepat di `/` dan halaman auth. Rute CMS memerlukan cookie sesi; API memvalidasi sesi dan permission. Login mengarahkan sesi yang valid ke `CMS_PICKER_PATH` (`/platform/pilih-aplikasi`).
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

## 4. Komponen, Tabel, Form, dan Upload

- **Primitif.** Tambahkan komponen Base UI melalui registry shadcn di `apps/cms`. Token warna, fokus, radius, dan CSS berada di `app/globals.css`. Panggil `Button` untuk aksi dan `ButtonLink` dengan `href` untuk navigasi. `PageHeader` menerima judul, deskripsi, dan aksi halaman.
- **Tabel.** Gunakan `Table` untuk markup sederhana dan `DataTable<T>` untuk kolom TanStack yang dikontrol fitur. Kirim baris dari satu halaman API, kolom, ID baris dan nama area gulir. Untuk pagination, isi `pageIndex` mulai nol, `pageSize`, total server, dan callback. Admin memakai `skip/take`, sedangkan pengguna serta audit memakai `page/perPage`. Filter baru kembali ke halaman pertama.
- **Status.** Peta label dan warna tinggal di fitur. `StatusBadge` menerima label dan tone. Gunakan `LoadingState`, `EmptyState`, atau `ErrorState` untuk memberi tahu pengguna apa yang terjadi, dengan aksi coba lagi jika ada.
- **Dialog.** Gunakan judul dan deskripsi, fokus awal yang sesuai, serta fokus kembali ke pemicu. Tentukan batas penutupan jika unggahan sedang berjalan. Form dan validasinya tetap berada di fitur.
- **Form:** React Hook Form + `zodResolver(schemas.ts)`; error validasi server (`BAD_USER_INPUT.fields`) dipetakan ke field form; tombol submit disable saat mutation berjalan.
- **Upload.** Gunakan klien multipart ke `POST /uploads` dengan cookie dan slug. Pakai `MediaPicker` untuk memilih berkas yang sudah tersimpan.

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
