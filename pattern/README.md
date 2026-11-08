# Pattern Koding — Platform CMS Multi-Aplikasi

Konsep koding untuk proyek ini (scope: CMS/platform dulu). Sifatnya **menjelaskan cara**, sementara `docs/` menjelaskan apa & kenapa, dan `features/` memetakan apa yang dikerjakan.

| File | Isi |
|---|---|
| [backend-pattern.md](backend-pattern.md) | NestJS + GraphQL code-first + Drizzle, multi-database, guard & permission |
| [frontend-pattern.md](frontend-pattern.md) | CMS web Next.js + Apollo: routing konteks aplikasi, auth, tabel, form |

> Pattern mobile (Expo) menyusul ditulis saat Fase 4 dimulai. Backend dan CMS disiapkan agar tidak menutup kebutuhannya: query `appConfig`, device token, dan offline-first untuk POS/CBT.

> `code-pattern/` adalah pattern proyek lama (SaaS Sport Management: Prisma, single-DB multi-tenant) — hanya referensi gaya, **jangan** diikuti untuk keputusan stack. Yang berlaku di sini mengikuti `docs/`.

## Konvensi Bersama Semua Lapisan

- **TypeScript `strict: true`**, tanpa `any` (gunakan tipe eksplisit, generics, atau `unknown` + validasi).
- **Import tipe harus `import type`** — runtime Bun tidak mengeliminasi import tipe otomatis; class untuk DI Nest tetap import nilai biasa.
- **Identifier kode Bahasa Inggris**; pesan ke pengguna Bahasa Indonesia.
- **ID adalah string di TypeScript/GraphQL** (`ID` scalar) — kolom Postgres-nya `bigint`, jangan expose angka mentah ke JSON.
- **Waktu dalam ISO-8601 UTC**; format lokal hanya di tampilan.
- File `kebab-case`, class/interface `PascalCase`, fungsi/variabel `camelCase`, tabel & kolom `snake_case`, env `UPPER_SNAKE_CASE`.
- Tidak ada secret di kode; hanya via environment.

## Keputusan Tertunda yang Mempengaruhi Pattern

- **Package manager: Bun** (+ Turborepo) — dikunci saat setup F00.
- Komponen UI web (shadcn-style atau alternatif) — pola di [frontend-pattern.md](frontend-pattern.md) tidak bergantung mereknya.
