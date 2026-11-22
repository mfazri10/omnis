# 03 — Fitur dan Modul

ID fitur merujuk ke PRD ([02-prd.md](02-prd.md)). Dokumen ini merinci modul **platform**; modul domain diringkas di bagian B dan dirinci dalam dokumen tersendiri saat fasenya dimulai.

## A. Modul Platform

### A1. Auth Admin — FR-PLAT-01

- Login email + kata sandi memakai better-auth; sesi cookie untuk CMS web.
- Lupa kata sandi: tautan reset via email dengan masa berlaku; ganti kata sandi dari profil.
- Nonaktifkan admin → semua sesinya dicabut (cek status aktif di setiap request terautentikasi).
- Identitas (better-auth `user`) terpisah dari profil (`admins`): satu identitas = satu profil admin.

### A2. Kerangka CMS & App Switcher — FR-PLAT-02

- Shell CMS: sidebar menu, header berisi app switcher + profil admin.
- Menu ada dua jenis: **global** (Aplikasi, Admin, Role, Audit Log — Super Admin / permission global) dan **konteks aplikasi** (dashboard, modul domain, user, media, notifikasi, pengaturan).
- App switcher hanya menampilkan aplikasi yang boleh diakses admin tersebut; pilihan tersimpan dan dikirim sebagai konteks (`X-App-Slug`) ke API.
- Menu yang tidak berhak tidak ditampilkan — dan API tetap menolak bila dipanggil langsung.

### A3. Registry & Provisioning Aplikasi — FR-PLAT-03, FR-PLAT-04

- Daftar aplikasi: nama, slug, ikon, status (`active`, `suspended`, `archived`), tanggal dibuat.
- Detail aplikasi: info paket Android/iOS, URL store, kredensial FCM (disimpan terenkripsi, tidak pernah ditampilkan utuh), catatan.
- Provisioning (satu alur, Super Admin): isi nama+slug → sistem membuat App DB → menjalankan migrasi → membuat config awal → mencatat registry → menulis audit log. Gagal di tengah = dibatalkan bersih (tidak ada aplikasi setengah jadi).
- Suspend: aplikasi tidak bisa diakses admin non-global dan API menolak konteksnya; data tidak dihapus. Archive: sembunyikan dari switcher.

### A4. Remote Config per Aplikasi — FR-PLAT-05

- Satu layar pengaturan per aplikasi: maintenance (saklar + pesan), versi minimum Android & iOS + URL store, identitas (nama tampil, logo, warna primer), kontak dukungan.
- Dibaca mobile lewat query `appConfig` (fase mobile); di Fase 1 diverifikasi lewat query + kriteria penerimaan.
- Perubahan config tercatat di audit log.

### A5. RBAC Dinamis — FR-PLAT-06, FR-PLAT-07

- Katalog permission dikelompokkan per modul (`platform.*`, `cbt.*`, `pos.*`, `debat.*`) — didaftarkan oleh kode modul, dibaca CMS sebagai daftar.
- Role: nama, deskripsi, cakupan (`global` atau aplikasi tertentu), himpunan permission. Contoh: "Editor Soal" (cakupan `tes-cpns`) = `cbt.questions.*` + `cbt.packages.view`.
- Penetapan: admin bisa memegang beberapa role di beberapa aplikasi (mis. Admin di `ngewarung`, Viewer di `debat`).
- Super Admin: flag global, melewati cek permission, tidak bisa dihapus peran terakhirnya.
- Desain penuh di [04-user-role-permission.md](04-user-role-permission.md).

### A6. Audit Log — FR-PLAT-08

- Tercatat: aktor, waktu, aplikasi (konteks), aksi, entitas + ID, ringkasan perubahan, IP.
- Filter: rentang tanggal, aplikasi, aktor, entitas. Hanya baca; retensi minimal 1 tahun.

### A7. Dashboard — FR-PLAT-09, FR-PLAT-10

- Global: kartu per aplikasi (status, jumlah user, aktivitas 7 hari), aktivitas platform terakhir, status antrian notifikasi.
- Per aplikasi: statistik dari modul domain (mis. CBT: jumlah soal, paket aktif, ujian bulan ini) + aktivitas terakhir aplikasi itu.

### A8. User Aplikasi — FR-PLAT-11

- Per konteks aplikasi: daftar (nama, email/HP, tanggal daftar, status), pencarian, detail, aktif/nonaktifkan.
- Login user aplikasi belum ada di Fase 1 (ikut fase mobile); tabel user diisi/dikelola dari CMS.
- Ekspor CSV (Should).

### A9. Media Library — FR-PLAT-12

- Per konteks aplikasi: unggah (batas tipe & ukuran), grid + pencarian, pakai ulang di modul.
- Upload lewat `POST /uploads` (REST, bukan GraphQL); metadata via GraphQL; file di object storage prefix `{slug-aplikasi}/`.

### A10. Notifikasi — FR-PLAT-13, FR-PLAT-14

- Kampanye per aplikasi: judul, isi, gambar opsional, target halaman, target audiens (`all`/segmen sederhana), kirim sekarang/terjadwal.
- Pekerja antrian (BullMQ + Redis): eksekusi tepat waktu, kirim via FCM kredensial aplikasi itu, catat terkirim/gagal, bersihkan token basi.
- Riwayat kampanye: status (`draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled`), jumlah target/terkirim, waktu.

## B. Modul Domain (ringkas)

| Modul | Entitas inti | Layar CMS inti | Rincian |
|---|---|---|---|
| Tes CPNS (CBT) | Bank soal, paket, sesi, hasil | Soal, paket, hasil & analitik, peserta | Ada ([F12](../features/F12-modul-pilot.md), selesai sebagian) |
| Ngewarung (POS) | Outlet, produk, stok, transaksi | Produk, stok, transaksi, laporan | Menyusul di fasenya |
| Debat | Mosi, argumen, voting | Mosi, moderasi, laporan pengguna | Menyusul di fasenya |

Setiap modul mengikuti aturan baku di [02-prd.md](02-prd.md) bagian 5.

## C. Fase Mobile (nanti — bukan scope Fase 1)

Dicatat agar desain platform tidak menutupnya: auth app-user (better-auth instance per App DB, token bearer), query `appConfig` + layar maintenance/force update, deep link notifikasi, dan **offline-first untuk POS dan CBT** (DB lokal + sinkronisasi). Stack yang disiapkan: satu bahasa TypeScript ujung-ke-ujung dengan codegen tipe GraphQL (lihat [08-tech-stack.md](08-tech-stack.md)).
