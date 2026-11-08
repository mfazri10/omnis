# Migrasi Database (doc 12)

- `platform/` — migrasi control-plane DB (`platform`).
- `app-template/` — migrasi template, berjalan di **semua** App DB.
- `app-<modul>/` (dibuat saat modulnya ada) — migrasi domain, hanya di App DB yang mengaktifkan modul itu.

Format file: `YYYYMMDDHHMMSS_<scope>_<deskripsi>.ts`, mengekspor `up` dan `down` (lihat `src/database/migration/migration-runner.ts`).

Perintah (dari `apps/api`):

```bash
bun run db:migrate status --scope platform
bun run db:migrate up --scope platform
bun run db:migrate down --scope platform --steps 1
bun run db:migrate up --scope app-template --db app_tes_cpns
```

Alur generate dari perubahan `entities/`:

```bash
bunx drizzle-kit generate --config=drizzle.config.platform.ts
```

Lalu bungkus hasil generate menjadi modul `up`/`down` sesuai konvensi (atau tulis modul kecil secara langsung). Jangan edit migrasi yang sudah diterapkan — forward-fix (doc 12 §7).

Catatan: file `.sql` + folder `meta/` hasil drizzle-kit tetap disimpan sebagai basis diff untuk generate berikutnya. Yang dieksekusi runner (`db:migrate`) hanyalah modul `.ts` — bukan file `.sql`.
