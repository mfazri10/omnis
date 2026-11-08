# 10 — Keputusan Terbuka

## 1. Keputusan yang Sudah Terkunci

| No | Pertanyaan | Keputusan | Tanggal |
|---|---|---|---|
| 1 | Model pengelolaan | Multi-aplikasi, **multi-database** (satu App DB per aplikasi + control-plane DB) | 2026-11-08 |
| 2 | Aplikasi awal | Tes CPNS (CBT), Ngewarung (POS), Debat — modul domain per aplikasi | 2026-11-08 |
| 3 | User | **Terpisah per aplikasi** (tanpa SSO lintas aplikasi) | 2026-11-08 |
| 4 | Role & permission | **Dinamis**, diatur dari CMS, cakupan global/per aplikasi | 2026-11-08 |
| 5 | Auth | **better-auth langsung** (Clerk dibatalkan); Fase 1: email + kata sandi admin | 2026-11-08 |
| 6 | Backend | **NestJS + TypeScript + GraphQL** | 2026-11-08 |
| 7 | Urutan kerja | **CMS/platform dulu**; aplikasi mobile menyusul | 2026-11-08 |
| 8 | Frontend CMS | **Next.js + Apollo + Tailwind** (dikunci via setup Full F00) | 2026-11-08 |
| 9 | Package manager & monorepo | **Bun + Turborepo** (Node.js sebagai runtime apps) | 2026-11-08 |

## 2. Sisa Pertanyaan

### Q1. Modul pilot pertama — mana yang dibangun di Fase 2? (PENTING)

Fase 1 (platform) tidak tergantung jawaban ini, tetapi Fase 2 tidak bisa mulai tanpanya.

| Pilihan | Pertimbangan |
|---|---|
| **A — Tes CPNS (disarankan)** | Domain paling mandiri (tanpa pembayaran/hardware/realtime); melatih pola modul baku lengkap: master data + transaksional + penilaian |
| B — Ngewarung | Masuk akal bila kebutuhan kasir paling mendesak; perlu keputusan outlet & metode bayar saat modulnya dibangun |
| C — Debat | Domain paling ringan; tetapi pola moderasi + voting kurang mewakili modul transaksional lain |

Cara jawab: cukup `Q1: A`.

### Q2. Frontend CMS — TERJAWAB

Diputuskan saat setup F00: **Next.js + Apollo + Tailwind** (scope Full F00). Scaffold `apps/cms` sudah mengikuti keputusan ini.

### Q3. Operasional

- Penyedia email transaksional + domain pengirim apa? (Wajib sebelum login admin bisa dipakai penuh — dibutuhkan di F01.)
- Hosting: sudah punya VPS/cloud? Anggaran bulanan? Batasan data-di-Indonesia?
- Target waktu fase 1 dan siapa operator CMS sehari-hari?

## 3. Asumsi Domain (dikonfirmasi saat modulnya dibangun)

Bukan pertanyaan pemblokir — tiap asumsi dicatat di sini dan dikonfirmasi sebelum modul itu dikerjakan:

- CBT: kategori TWK/TIU/TKP dengan penskoran TKP skala 1–5; passing grade konfigurabel per paket; ujian offline (fase mobile).
- POS: multi-outlet (default 1 outlet); pembayaran v1 dicatat manual (tunai/QRIS/transfer); offline-first wajib di fase mobile.
- Debat: vote bisa diubah sampai mosi ditutup; komentar fase lanjutan; realtime belakangan.
