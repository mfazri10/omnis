# 04 — User, Role, dan Permission (RBAC Dinamis)

Role dan permission **tidak hardcode** — didefinisikan dan dirangkai dari CMS. Kode backend hanya mendaftarkan katalog permission dan memeriksa permission yang dibutuhkan tiap operasi.

## 1. Aktor

| Aktor | Disimpan di | Keterangan |
|---|---|---|
| Super Admin | Control-plane (`admins`, flag `is_super_admin`) | Akses penuh lintas aplikasi; minimal 1 aktif selalu |
| Admin/Operator/Editor/Viewer | Control-plane | Bukan peran bawaan — melainkan **role yang dirangkai dari permission** dan ditetapkan per aplikasi |
| User aplikasi | App DB (`users`) | Peserta ujian, kasir, pendebat — dikelola lewat CMS, bukan pengguna CMS |

Tidak ada role bawaan selain Super Admin. Contoh "Admin Tes CPNS" atau "Editor Soal" adalah role yang dibuat lewat CMS memakai pola di bagian 4.

## 2. Permission

Format: `modul.entitas.aksi` — huruf kecil, titik sebagai pemisah.

| Segmen | Contoh |
|---|---|
| Modul | `platform`, `cbt`, `pos`, `debat` |
| Entitas | `questions`, `products`, `motions`, `roles`, `media` |
| Aksi | `view`, `create`, `update`, `delete`, `publish`, `send`, `manage` |

Contoh permission utuh:

- `platform.apps.manage` — kelola registry & provisioning (implisit Super Admin; hanya untuk role global)
- `platform.roles.manage` — kelola role & penetapannya
- `platform.users.manage` — kelola user aplikasi dalam cakupannya
- `cbt.questions.publish` — menerbitkan soal
- `pos.transactions.void` — membatalkan (void) transaksi
- `debat.arguments.moderate` — menyetujui/menolak argumen

Aturan:

1. Setiap modul NestJS **mendaftarkan** katalog permission-nya saat booting (seed bila belum ada). CMS membaca katalog sebagai daftar untuk dirangkai.
2. Permission yang tidak terdaftar tidak bisa dicek — operasi tanpa permission yang jelas adalah bug.
3. Aksi `manage` pada suatu entitas mencakup semua aksi entitas itu (convenience, diuraikan saat dicek).
4. Permission `platform.*` yang sensitif (apps, roles, admins) hanya berlaku pada role bercakupan `global`.

## 3. Role dan Cakupan (Scope)

Role = nama + deskripsi + cakupan + himpunan permission.

| Cakupan | Arti | Contoh |
|---|---|---|
| `global` | Berlaku lintas aplikasi; boleh memegang `platform.*` sensitif | "Platform Operator" |
| Satu aplikasi (`app_id`) | Hanya berlaku dalam aplikasi itu; permission `platform.*` sensitif tidak tersedia | "Editor Soal" di `tes-cpns` |

Penetapan role ke admin bersifat per aplikasi: satu admin dapat memegang role berbeda di aplikasi berbeda (mis. `pos.*` penuh di `ngewarung`, hanya `view` di `debat`).

## 4. Contoh Role (dibuat lewat CMS, bukan bawaan)

| Role | Cakupan | Permission (contoh isi) |
|---|---|---|
| Editor Soal | `tes-cpns` | `cbt.questions.create/update/view`, `cbt.packages.view`, `platform.media.*` (dalam aplikasi itu) |
| Admin Tes CPNS | `tes-cpns` | Seluruh `cbt.*` + `platform.users.manage` + `platform.notifications.*` + `platform.app-config.manage` |
| Supervisor Warung | `ngewarung` | Seluruh `pos.*` + `platform.users.manage` |
| Moderator Debat | `debat` | `debat.arguments.moderate`, `debat.reports.manage`, `debat.motions.view` |
| Viewer | per aplikasi | `*.view` + dashboard dalam aplikasi itu |
| Platform Operator | `global` | `platform.apps.view`, `platform.audit.view` (baca lintas aplikasi, tanpa ubah) |

## 5. Penegakan

1. **Di server, selalu.** Setiap operasi GraphQL app-scoped mendeklarasikan permission yang dibutuhkan; guard memeriksa: admin aktif + (Super Admin **atau** punya permission dalam cakupan aplikasi konteks). Gagal → error `FORBIDDEN`.
2. **Konteks aplikasi dari server.** Header `X-App-Slug` divalidasi terhadap registry dan hak admin — slug fiktif atau aplikasi di luar haknya ditolak sebelum resolver berjalan.
3. **CMS hanya mengikuti.** Menu/tombol disembunyikan berdasarkan permission yang dibaca dari API — kemudahan tampilan, bukan pengaman.
4. **Perubahan berlaku cepat.** Pencabutan role/penonaktifan admin berlaku paling lambat pada request berikutnya (cek status aktif tiap request; permission di-cache singkat dengan invalidasi saat role berubah).

## 6. Aturan Akun

- Satu email = satu identitas better-auth = satu profil admin.
- Super Admin terakhir yang aktif tidak dapat dinonaktifkan/dicabut dari CMS (mencegah sistem terkunci).
- Akun dinonaktifkan (bukan dihapus) agar audit log tetap bisa ditelusuri.
- User aplikasi yang dinonaktifkan tidak bisa login saat fase mobile tiba; datanya tetap ada.
