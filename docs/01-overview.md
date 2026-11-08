# 01 — Overview

## 1. Latar Belakang

Ada beberapa aplikasi mobile berbeda yang akan dibangun — dimulai dari Tes CPNS (ujian CBT), Ngewarung (kasir/POS), dan aplikasi Debat — dan semuanya harus bisa dikelola dari **satu CMS**. Setiap aplikasi punya domain data, user, dan tim pengelola yang berbeda, sehingga pendekatannya adalah **isolasi penuh per aplikasi** (multi-database), bukan multi-tenant satu database.

Fase 1 membangun fondasinya dulu: platform/CMS-nya. Aplikasi mobile menyusul setelah fondasi kokoh.

## 2. Tujuan

1. Satu CMS menjadi pusat kendali semua aplikasi: pindah aplikasi lewat app switcher, menu dan data mengikuti aplikasi yang dipilih.
2. Menambah aplikasi baru semurah mungkin: provisioning database + registrasi, tanpa mengubah inti platform.
3. Setiap aplikasi terisolasi penuh: database sendiri, user sendiri, konfigurasi sendiri, admin sendiri.
4. Role & permission tidak hardcode — didefinisikan dan diatur dari CMS, dengan cakupan per aplikasi.
5. Fondasi API (GraphQL) dan auth (better-auth) siap dipakai aplikasi mobile saat fasenya tiba, tanpa desain ulang.

## 3. Ruang Lingkup Fase 1 (CMS/Platform)

### 3.1 Dalam Ruang Lingkup

- Control-plane: registry aplikasi + provisioning DB per aplikasi, remote config per aplikasi, auth admin (better-auth), RBAC dinamis, audit log, dashboard global & per aplikasi.
- Layanan platform per aplikasi: manajemen user aplikasi, media library, kampanye push notification terjadwal.
- Modul domain aplikasi pertama (modul pilot — pilihan di [10-keputusan-terbuka.md](10-keputusan-terbuka.md), usulan: Tes CPNS).
- Backend NestJS + GraphQL sebagai satu-satunya akses data (CMS web tidak menyentuh database langsung).

Rincian modul per aplikasi ditulis sebagai dokumen tersendiri saat fasenya dimulai.

### 3.2 Di Luar Ruang Lingkup Fase 1

- Aplikasi mobile (Android/iOS) — fase tersendiri setelah CMS beres.
- Login user aplikasi (auth app-user) — polanya disiapkan, implementasinya ikut fase mobile.
- Integrasi pembayaran, gateway QRIS, dan hardware POS (printer, cash drawer).
- Fitur realtime (hasil voting live, dsb.) — skema GraphQL subscription dicadangkan, implementasi belakangan.

## 4. Target Pengguna CMS

| Pengguna | Kebutuhan utama |
|---|---|
| Super Admin | Kendali penuh lintas aplikasi: registry, provisioning, admin, role |
| Admin aplikasi | Kelola operasional satu (atau beberapa) aplikasi yang menjadi cakupannya |
| Operator/Editor | Tugas terbatas (input soal, kelola produk, moderasi) sesuai permission yang diberikan |
| Viewer | Baca saja (mis. pemilik usaha, auditor) |

User aplikasi mobile (peserta ujian, kasir, pendebat) **bukan** pengguna CMS — mereka dikelola *lewat* CMS.

## 5. Asumsi yang Masih Berlaku

1. Bahasa antarmuka CMS: Bahasa Indonesia.
2. Semua aplikasi mobile nantinya mengonsumsi GraphQL yang sama dengan konteks per aplikasi.
3. Ngewarung/POS dan Tes CPNS/CBT diasumsikan butuh kemampuan **offline-first** di fase mobile — desain API dan sinkronisasi disiapkan dari sekarang.

## 6. Glosarium

| Istilah | Arti |
|---|---|
| Control-plane | Backend + database pusat: data lintas aplikasi (apps, admin, role, audit) |
| App DB | Database milik satu aplikasi: user & data domainnya |
| Provisioning | Proses mendaftarkan aplikasi baru: buat DB, migrasi, registrasi, config awal |
| App switcher | Pemilih aplikasi di CMS; menentukan konteks (database & menu) yang aktif |
| RBAC dinamis | Role & permission didefinisikan dari CMS, bukan hardcode di kode |
| Permission | Hak atomik berformat `modul.entitas.aksi`, mis. `cbt.questions.publish` |
| Cakupan (scope) | Batas berlaku sebuah role: `global` atau satu aplikasi tertentu |
| Remote config | Konfigurasi per aplikasi dari server: maintenance, versi minimum, tema |
| Force update | Kewajiban update aplikasi bila versi pengguna di bawah versi minimum |
| FCM | Firebase Cloud Messaging — layanan push notification |
