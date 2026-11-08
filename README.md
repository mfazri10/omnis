# Platform CMS Multi-Aplikasi Mobile

Satu CMS untuk mengelola banyak aplikasi mobile (Tes CPNS, Ngewarung, Debat, ...). Scope saat ini: **Fase 1 — CMS/platform** (aplikasi mobile menyusul di Fase 4).

- Kebutuhan & desain: [docs/](docs/README.md)
- Peta kerja: [features/](features/README.md)
- Konsep koding: [pattern/](pattern/README.md)

## Prasyarat

Bun ≥ 1.4 (package manager), Node.js ≥ 22 (runtime apps), Docker + Docker Compose, Git.

## Mulai Cepat (Development)

```bash
# 1. Install semua workspace
bun install

# 2. Siapkan environment (3 file)
Copy-Item .env.example .env                   # docker-compose
Copy-Item apps\api\.env.example apps\api\.env # API
Copy-Item apps\cms\.env.example apps\cms\.env.local  # CMS

# 3. Jalankan Postgres + Redis
docker compose up -d

# 4. Jalankan API + CMS (Turborepo)
bun run dev
```

- API: http://localhost:3000/graphql (health: `/health`)
- CMS: http://localhost:3001

## Perintah Umum

| Perintah | Fungsi |
|---|---|
| `bun run dev` | Jalankan semua app (mode dev) |
| `bun run build` | Build semua (packages dulu otomatis) |
| `bun run lint` | Lint semua workspace |
| `bun run typecheck` | Typecheck semua workspace |
| `bun run test` | Tes semua workspace |
| `turbo dev --filter=api` | Jalankan satu app saja |

## Struktur

```text
apps/api/        # Backend NestJS + GraphQL + Drizzle (port 3000)
apps/cms/        # CMS web Next.js + Apollo (port 3001)
packages/        # Config & library internal (@workspace/*)
docs/            # Dokumentasi kebutuhan & desain
features/        # Peta fitur per file
pattern/         # Konsep koding per lapisan
```
