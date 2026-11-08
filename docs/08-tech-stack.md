# 08 — Tech Stack

Dibagi dua: **terkunci** (keputusan pemilik produk, tidak diubah tanpa diskusi) dan **rekomendasi** (pilihan teknis yang bisa diganti tanpa mengubah arsitektur).

## 1. Terkunci

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Backend | NestJS + TypeScript | Monolit modular: `PlatformModule` + modul per aplikasi |
| API | GraphQL (code-first) | Satu endpoint; upload file via REST terpisah |
| Auth | better-auth | Self-hosted; Fase 1: email + kata sandi untuk admin (sesi cookie). Instance per App DB untuk user aplikasi di fase mobile |
| Database | PostgreSQL, multi-database | `platform` + `app_{slug}` per aplikasi |
| Antrian | Redis + BullMQ | Kampanye notifikasi terjadwal |
| Push | Firebase Cloud Messaging | Kredensial per aplikasi di registry |
| Object storage | S3-compatible | Prefix per aplikasi (`{slug}/`) + `platform/` |
| Email transaksional | Penyedia SMTP/API (TBD) | Wajib ada untuk verifikasi & reset kata sandi better-auth |

## 2. Rekomendasi (bisa diganti tanpa mengubah arsitektur)

| Lapisan | Rekomendasi | Alasan |
|---|---|---|
| CMS web | Next.js (React) + Apollo Client + Tailwind | Satu bahasa TS ujung-ke-ujung; sesi cookie better-auth terintegrasi alami; ekosistem komponen admin matang |
| ORM + migrasi | Drizzle ORM | Ringan, migrasi SQL eksplisit per database, cocok untuk connection factory multi-DB; adapter better-auth tersedia (verifikasi versi terbaru saat implementasi) |
| Codegen tipe | GraphQL Code Generator | Tipe operasi ter-generate untuk CMS (dan kelak mobile) dari skema yang sama |
| Mobile (fase nanti) | Expo (React Native) + Apollo + codegen | TS end-to-end; offline-first POS/CBT via DB lokal + sinkronisasi (pola disiapkan di mini-PRD) |
| Deploy Fase 1 | Satu VPS, Docker Compose | Postgres + Redis + API + worker + CMS web; murah dan cukup untuk awal |

## 3. Yang Sengaja Tidak Dipakai

- **Clerk / auth SaaS** — diputuskan memakai better-auth langsung agar tidak ada migrasi auth di tengah jalan.
- **REST untuk API utama** — GraphQL dipilih karena CMS multi-aplikasi + mobile butuh query fleksibel dalam satu endpoint.
- **Microservices** — monolit modular cukup; App DB sudah memberi isolasi data.
- **Satu DB multi-tenant** — ditolak; isolasi penuh per aplikasi adalah kebutuhan eksplisit.

## 4. Dependensi yang Harus Disiapkan Sejak Fase 0

1. Akun penyedia email transaksional + domain terkirim (SPF/DKIM) — better-auth tidak berguna tanpa email yang sampai.
2. Bucket object storage + kredensialnya.
3. Proyek Firebase (FCM) — minimal satu untuk pengembangan kampanye; per aplikasi saat onboarding.

## 5. Alternatif yang Dipertimbangkan

| Pilihan | Status | Alasan tidak dipilih |
|---|---|---|
| Laravel + Filament + REST (usulan awal docs 0.1) | Ditolak | Pemilik produk memutuskan stack TypeScript |
| Prisma / TypeORM sebagai ORM | Cadangan | Bisa menggantikan Drizzle; pastikan mendukung koneksi dinamis multi-DB dan adapter better-auth |
| Flutter untuk mobile | Cadangan | Layak bila tim mobile lebih kuat di Dart; biayanya: dua bahasa + codegen GraphQL terpisah |
