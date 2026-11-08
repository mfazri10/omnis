# Dokumentasi — Platform CMS Multi-Aplikasi Mobile

> Satu CMS untuk mengelola banyak aplikasi mobile yang berbeda domain (Tes CPNS/CBT, Ngewarung/POS, Debat, dan aplikasi berikutnya). Setiap aplikasi terisolasi penuh di database-nya sendiri; satu control-plane mengatur aplikasi, admin, role, dan operasional lintas aplikasi.

| Item | Detail |
|---|---|
| Nama proyek | Platform CMS Multi-Aplikasi Mobile |
| Versi dokumen | 0.3.1 — Lengkap, cakupan dokumen 01–17 |
| Tanggal | 8 November 2026 |
| Status | Terkunci untuk Fase 1 (CMS/platform). Satu pertanyaan sisa: modul pilot pertama — lihat [10-keputusan-terbuka.md](10-keputusan-terbuka.md) |
| Bahasa dokumen | Bahasa Indonesia (identifier kode memakai Bahasa Inggris) |

## Keputusan yang Sudah Terkunci

| Aspek | Keputusan |
|---|---|
| Model | Multi-aplikasi, multi-database (satu DB per aplikasi + satu control-plane DB) |
| Backend | NestJS + TypeScript + GraphQL |
| Auth | better-auth langsung (email + kata sandi), tanpa Clerk |
| User | Terpisah per aplikasi |
| Role & permission | Dinamis, diatur dari CMS |
| Scope Fase 1 | CMS/platform dulu; aplikasi mobile menyusul |

## Daftar Dokumen

| No | Dokumen | Isi |
|---|---|---|
| 01 | [Overview](01-overview.md) | Latar belakang, tujuan, ruang lingkup, glosarium |
| 02 | [PRD](02-prd.md) | Kebutuhan produk CMS/platform, user story, kriteria penerimaan |
| 03 | [Fitur dan Modul](03-fitur-dan-modul.md) | Modul platform + ringkasan modul per aplikasi |
| 04 | [User, Role, Permission](04-user-role-permission.md) | Desain RBAC dinamis dengan cakupan per aplikasi |
| 05 | [Arsitektur Sistem](05-arsitektur-sistem.md) | Control-plane + multi-DB, modul NestJS, alur utama |
| 06 | [Desain Database](06-database-design.md) | Skema control-plane + template DB aplikasi |
| 07 | [Desain API](07-api-design.md) | Konvensi GraphQL, konteks aplikasi, upload, error |
| 08 | [Tech Stack](08-tech-stack.md) | Stack terkunci vs rekomendasi |
| 09 | [Roadmap](09-roadmap.md) | Fase 0–4, estimasi, risiko |
| 10 | [Keputusan Terbuka](10-keputusan-terbuka.md) | Keputusan terkunci + sisa pertanyaan |
| 11 | [Connection Pooling](11-connection-pooling.md) | Strategi connection pooling multi-DB, lazy pool, PgBouncer |
| 12 | [Strategi Migrasi](12-migration-strategy.md) | Migrasi control-plane + App DB, migration registry, CLI runner |
| 13 | [Provisioning Saga](13-provisioning-saga.md) | Saga & kompensasi alur provisioning aplikasi baru, anti-orphan |
| 14 | [Strategi Caching](14-caching-strategy.md) | Redis cache untuk session, admin status, RBAC permissions, invalidasi |
| 15 | [Strategi Testing](15-testing-strategy.md) | Unit, integrasi, E2E dengan multi-DB test setup & fixture |
| 16 | [Operasional Teknis](16-operasional-teknis.md) | Rate limiting, health check, monitoring, backup/restore, soft delete |
| 17 | [ERD](17-erd.md) | Diagram relasi database (Mermaid): control-plane + template App DB |

## Cara Membaca Dokumen Ini

1. Mulai dari [01-overview.md](01-overview.md), lalu [02-prd.md](02-prd.md) sebagai sumber kebenaran.
2. [03](03-fitur-dan-modul.md)–[08](08-tech-stack.md) adalah turunan fungsional & arsitektur, sedangkan [11](11-connection-pooling.md)–[16](16-operasional-teknis.md) adalah detail teknis implementasi & operasional multi-DB. [17-erd.md](17-erd.md) adalah visualisasi dari [06-database-design.md](06-database-design.md).
3. Dokumen rincian modul per aplikasi (Tes CPNS, Ngewarung, Debat) menyusul ditulis saat fasenya dimulai — Fase 1 hanya mencakup platform/CMS.
4. Sisa satu pertanyaan di [10-keputusan-terbuka.md](10-keputusan-terbuka.md) menentukan isi Fase 2.

## Konvensi

- **Wajib (Must)** — tanpa ini fase terkait tidak bisa selesai.
- **Sebaiknya (Should)** — penting, boleh mundur satu fase bila waktu terbatas.
- **Nice to Have (Could)** — opsional.
- **Control-plane** = backend + database pusat (aplikasi, admin, role, audit). **App DB** = database milik satu aplikasi (user & data domainnya).
- Slug aplikasi: `tes-cpns`, `ngewarung`, `debat`.
- Identifier kode (tabel, permission, operasi GraphQL) memakai Bahasa Inggris; label tampilan CMS berbahasa Indonesia.

## Riwayat Perubahan

| Versi | Tanggal | Perubahan |
|---|---|---|
| 0.3.1 | 2026-11-08 | Tambah ERD (17): diagram Mermaid control-plane + template App DB |
| 0.3.0 | 2026-11-08 | Tambah dokumen teknis pelengkap (11–16): pooling, migrasi, saga, caching, testing, operasional |
| 0.2.1 | 2026-11-08 | Cakupan docs sampai nomor 10; dokumen rincian modul per aplikasi menyusul di fasenya |
| 0.2.0 | 2026-11-08 | Tulis ulang spesifik: multi-app multi-DB, NestJS+GraphQL+better-auth, RBAC dinamis, scope CMS-first |
| 0.1.0 | 2026-11-07 | Draft awal generik (satu aplikasi, REST) — digantikan versi ini |
