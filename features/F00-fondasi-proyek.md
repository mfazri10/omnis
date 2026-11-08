# F00 — Fondasi Proyek & Infrastruktur

| Item | Detail |
|---|---|
| FR | — (penopang semua fitur) |
| Fase | 0–1 |
| Prioritas | Must |
| Status | Selesai |
| Dependensi | — |

## Tujuan

Repositori, lingkungan dev, dan kerangka backend siap menampung seluruh fitur platform sebelum fitur pertama dibangun.

## Lingkup Backend

- [x] Struktur monorepo: `apps/api` (NestJS), `apps/cms` (web), `packages/` bersama (config, types)
- [x] Docker Compose dev: Postgres, Redis, API, worker, CMS web — satu perintah jalan
- [x] Koneksi database: control-plane (tetap) + connection factory App DB dinamis per slug
- [x] Sistem migrasi per database (control-plane + template App DB)
- [x] GraphQL code-first menyala + batas kompleksitas/kedalaman query
- [x] Konfigurasi environment per lingkungan (dev/staging/prod); tanpa secret di repo
- [x] Health-check endpoint (`/health`: API, control-plane DB, Redis)
- [x] CI dasar: install, lint, typecheck, tes unit

## Lingkup CMS UI

- [x] Aplikasi web menyala dengan halaman kosong + koneksi GraphQL terbukti (query health/version tampil)

## Kriteria Selesai

1. `docker compose up` dari repo bersih menghasilkan seluruh layanan hijau.
2. Query GraphQL sederhana (mis. versi API) berhasil dari CMS web.
3. Migrasi control-plane naik-turun bersih.
4. CI hijau pada pull request.

## Referensi

- [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md) bagian 3 & 6
- [docs/08-tech-stack.md](../docs/08-tech-stack.md)
- [docs/09-roadmap.md](../docs/09-roadmap.md) Fase 0
