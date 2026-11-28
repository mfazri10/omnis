# F14: Manajemen Menu Mobile per Aplikasi

| Item | Detail |
|---|---|
| FR | Usulan kebutuhan baru: navigasi mobile dapat dikonfigurasi per aplikasi |
| Fase | 3 |
| Prioritas | Must untuk aplikasi mobile yang memakai menu dinamis |
| Status | Backend admin tahap pertama selesai; tahap CMS UI selesai (identifier, tanpa manifest); migrasi sudah diterapkan ke control-plane produksi; integrasi F13 belum mulai |
| Dependensi | F03, F05, F06, F13 |

## Tujuan

Super Admin mengatur struktur navigasi mobile untuk setiap aplikasi dari CMS. Saat developer menambahkan fitur khusus ke aplikasi, menu dapat menunjuk ke layar yang sudah didaftarkan oleh aplikasi tanpa mengubah definisi menu CMS atau menyimpan rute bebas di database.

Pengaturan menu tidak membuat layar, rute, atau endpoint fitur. Developer tetap mengimplementasikan fitur tersebut. Backend tetap memeriksa autentikasi dan izin pada setiap operasi, terlepas dari menu yang ditampilkan.

Pengelolaan F14 di CMS mengikuti RBAC admin F05. Role admin dapat membatasi siapa yang melihat halaman Menu Mobile dan tombol aksi di dalamnya. Izin tersebut tidak menjadi role atau permission untuk pengguna akhir aplikasi mobile.

## Kondisi Saat Ini

- Sidebar CMS didefinisikan di `apps/cms/features/shell/menu.ts`. F14 tidak mengubah menu CMS tersebut.
- F13 merencanakan generator source mobile, tetapi generator dan aplikasi mobile belum tersedia di repo.
- F05 menyimpan role-permission dan menegakkan permission pada operasi API. UI menyaring menu dan tombol berdasarkan permission yang sama.
- Skema awal yang diberikan belum memiliki `app_id`, sehingga belum dapat memisahkan konfigurasi antar aplikasi. Tabel sementara bernama `Untitled`, tetapi sequence dan foreign key merujuk ke `menus`.

## Pendekatan

| Pendekatan | Dampak |
|---|---|
| Menyimpan menu CMS di database | Mengubah sidebar CMS, tetapi belum menyiapkan navigasi di aplikasi mobile. |
| Menyimpan menu mobile per aplikasi | CMS mengelola struktur menu khusus aplikasi. Rute tetap berasal dari fitur yang terdaftar di source mobile. Ini pendekatan yang dipilih. |
| Memakai satu katalog untuk CMS dan mobile | Menyatukan dua navigasi, tetapi menambah cakupan migrasi dan risiko perubahan pada shell CMS. |

Pendekatan kedua dipilih agar konfigurasi menu mobile siap tanpa mengubah navigasi CMS yang sudah berjalan. Pilihan ini tidak menjanjikan pembuatan fitur mobile tanpa perubahan source code.

## Tahap Backend Pertama

Tahap pertama membangun tabel control-plane, CRUD GraphQL untuk admin CMS, permission app-scoped F05, dan audit log.

API baca runtime untuk aplikasi mobile, autentikasi sesi user aplikasi, serta penerbitan dan validasi manifest rute/ikon ditunda sampai kontrak F13 tersedia. Pada tahap pertama, `route_key` dan `icon_key` divalidasi sebagai identifier, bukan URL, path, atau kode bebas. Validasi kecocokan dengan layar dan ikon terpasang menyusul bersama F13.

## Lingkup Backend

- [x] Simpan konfigurasi menu di control-plane DB, bukan di App DB.
- [x] Kaitkan setiap menu dengan satu `app_id` dari registry F03.
- [x] Sediakan operasi untuk membaca, membuat, mengubah, mengurutkan, memindahkan parent, mengaktifkan, menonaktifkan, dan menghapus menu. Tolak penghapusan parent yang masih memiliki anak; jangan menghapus subtree secara otomatis.
- [x] Validasi bahwa parent dan menu berada pada aplikasi yang sama, tidak membentuk siklus, dan `slug` unik dalam aplikasi.
- [x] Pada tahap pertama, validasi format `route_key` dan `icon_key` sebagai identifier. Validasi ke manifest aplikasi ditunda sampai integrasi F13.
- [x] Daftarkan permission admin CMS `platform.mobile-menus.view`, `platform.mobile-menus.create`, `platform.mobile-menus.update`, dan `platform.mobile-menus.delete` melalui katalog F05, dengan cakupan aplikasi. Permission `.manage` dapat menjadi kemudahan yang mencakup aksi-aksi tersebut sesuai aturan F05.
- [x] Lindungi query dan mutation pengelolaan dengan permission yang sesuai. Operasi baca memerlukan `.view`; pembuatan memerlukan `.create`; perubahan, pengurutan, dan perubahan status memerlukan `.update`; penghapusan memerlukan `.delete`. Super Admin tetap bypass.
- [ ] Tahap lanjutan F13: sediakan API platform read-only untuk menu mobile yang memvalidasi sesi user aplikasi dan menentukan `app_id` dari identitas aplikasi tervalidasi.
- [ ] Tahap lanjutan F13: simpan manifest rute dan ikon per aplikasi; CMS hanya menawarkan nilai dari manifest yang diterbitkan source mobile.
- [ ] Jangan berikan akses langsung ke control-plane DB kepada source backend yang dihasilkan F13.
- [x] Tulis audit log untuk perubahan menu, termasuk pengurutan dan perubahan status.

## Lingkup CMS UI

- [x] Sediakan halaman **Menu Mobile** pada konteks aplikasi yang dipilih (`/{appSlug}/menu-mobile`, commit f6e943a).
- [x] Tampilkan halaman dan datanya hanya untuk admin dengan `platform.mobile-menus.view` pada aplikasi yang dipilih; Super Admin dapat mengakses lintas aplikasi.
- [x] Izinkan admin dengan permission yang sesuai mengubah hierarki (parent via select tanpa diri/keturunan), label, slug, ikon (`icon_key`), layar tujuan (`route_key`, identifier tahap awal), urutan (field urutan + Naik/Turun), dan status aktif.
- [x] Tampilkan pohon menu hasil konfigurasi, termasuk parent dan submenu, sebelum perubahan disimpan (kartu Pohon menu).
- [ ] Tampilkan layar tujuan dari daftar layar yang didaftarkan aplikasi; jangan menerima URL atau path sembarang. (Menunggu manifest F13; tahap awal memakai input identifier dengan validasi format `^[a-z][a-z0-9._-]{0,254}$`, URL/path ditolak.)
- [x] Tahap UI setelah backend: tampilkan checkbox permission di form Role di bawah grup Menu Mobile: lihat, buat, ubah/urutkan/aktifkan, dan hapus. Simpan assignment melalui `role_permissions` F05, bukan tabel role-menu baru (commit ef08d3f).
- [x] Tahap UI setelah backend: sembunyikan atau nonaktifkan setiap tombol sesuai permission aksinya. Tombol bukan sumber otorisasi; mutation tetap memeriksa permission yang sama di server.
- [x] Tampilkan error validasi dari API dan pertahankan input yang belum berhasil disimpan.
- [x] Jangan mengubah item sidebar CMS melalui halaman ini. (Item sidebar "Menu Mobile" ditambahkan sebagai navigasi ke halaman, bukan diubah oleh halaman; sidebar CMS lain tetap.)

## Lingkup Aplikasi Mobile (Tahap Lanjutan F13)

- [ ] Aplikasi mobile membaca menu dari API platform saat berjalan, menggunakan sesi user aplikasi yang divalidasi melalui integrasi F13.
- [ ] Klien mengubah `route_key` menjadi layar yang sudah terdaftar di source aplikasi.
- [ ] Klien menampilkan menu aktif berdasarkan urutan dan parent dari server.
- [ ] Menu tidak menjadi mekanisme otorisasi. Endpoint fitur tetap memeriksa identitas aplikasi dan sesi pengguna di server.
- [ ] Permission admin CMS F05 tidak digunakan untuk menyaring menu atau tombol pengguna akhir aplikasi mobile. RBAC pengguna mobile, bila diperlukan, dirancang terpisah di App DB.
- [ ] Bila konfigurasi menunjuk ke layar yang tidak tersedia pada versi klien, klien tidak membuka rute lain sebagai fallback; tampilkan atau catat kondisi tersebut sesuai pola error F13.

## Rancangan Data

Buat tabel `menus` di control-plane DB. Skema awal adalah acuan, bukan migrasi siap pakai.

| Kolom | Aturan yang diusulkan |
|---|---|
| `id` | Primary key bigint. |
| `app_id` | Wajib, foreign key ke `apps.id`. |
| `name` | Label yang ditampilkan pada navigasi. |
| `slug` | Identitas stabil dan unik per aplikasi; unique bersama `app_id`. |
| `route_key` | Opsional untuk parent/group; jika diisi, harus cocok dengan layar terdaftar. Ganti nama `route` agar tidak dibaca sebagai URL bebas. |
| `icon_key` | Kunci ikon dari katalog yang didukung oleh template mobile; bukan nama komponen arbitrer. |
| `parent_id` | Opsional; parent harus berada pada aplikasi yang sama. |
| `order_no` | Bilangan urut dalam daftar sibling; urutan seri diputus dengan `id`. |
| `is_active` | Menentukan apakah item dikirim ke klien mobile. |
| `created_at`, `updated_at` | Timestamp sesuai pola tabel control-plane. |

Permission pengelolaan CMS tidak disimpan pada baris menu mobile. Katalog F05 mendefinisikan permission untuk halaman dan tombol pengelolaan Menu Mobile, lalu role admin menerima permission tersebut melalui `role_permissions`. Setiap mutation menggunakan permission yang sama di API. Jangan membuat tabel assignment role-menu atau role-button baru.

| Bagian CMS Menu Mobile | Permission |
|---|---|
| Membuka halaman dan membaca daftar | `platform.mobile-menus.view` |
| Tombol tambah | `platform.mobile-menus.create` |
| Tombol simpan, urutkan, aktifkan, dan nonaktifkan | `platform.mobile-menus.update` |
| Tombol hapus | `platform.mobile-menus.delete` |

`platform.mobile-menus.manage` boleh dipakai sebagai permission ringkas sesuai aturan ekspansi F05. Semua permission di atas app-scoped. Role yang ditetapkan untuk aplikasi A tidak memberi hak mengelola menu aplikasi B.

Constraint yang diperlukan:

- `UNIQUE (app_id, slug)`.
- Foreign key komposit `(app_id, parent_id)` ke `(app_id, id)` agar menu tidak dapat menjadi anak menu aplikasi lain.
- Tolak parent yang membuat siklus melalui validasi service.
- Gunakan `ON DELETE RESTRICT` untuk parent. Admin dapat menghapus menu daun dengan permission `.delete`; menu yang masih memiliki anak harus dikosongkan atau dipindahkan dahulu. Nonaktifkan menu bila konfigurasi perlu dipertahankan.

Pada backend tahap pertama, `route_key` dan `icon_key` adalah identifier opaque yang tervalidasi formatnya dan tidak boleh berupa URL, path, atau kode. Integrasi F13 nantinya menghubungkan identifier tersebut ke manifest versi aplikasi di control-plane; klien mobile tetap memastikan layar tersedia pada build yang sedang berjalan.

## Akses dan Isolasi

- Super Admin memiliki akses penuh. Admin lain hanya dapat membaca atau mengelola konfigurasi aplikasi bila role mereka memiliki permission app-scoped yang sesuai.
- Daftar permission di form Role dikelompokkan di bawah menu CMS **Menu Mobile**. `view` mengatur akses halaman; `create`, `update`, dan `delete` membatasi tombol serta operasi terkait.
- Perubahan permission UI tidak mengubah aturan server. API selalu menegakkan permission F05 yang sama, termasuk saat dipanggil langsung.
- Setiap perubahan harus terikat pada aplikasi yang sudah ada dan konteks aplikasi yang tervalidasi. Jangan mempercayai `app_id` dari input tanpa memeriksa hak dan registry.
- Tahap integrasi F13: API baca mobile memvalidasi sesi user aplikasi melalui adapter F13 dan membatasi hasil ke aplikasi yang terikat pada sesi tersebut. Jangan menganggap `app_slug` yang dikirim klien sebagai bukti autentikasi.
- Endpoint menu mobile hanya mengembalikan konfigurasi untuk satu aplikasi. Jangan menggabungkan menu lintas aplikasi.
- Permission admin CMS hanya melindungi pengelolaan konfigurasi. Menu aktif tidak memberi izin kepada pengguna mobile untuk menjalankan fitur; backend tetap memeriksa autentikasi dan otorisasi fitur.
- Jangan mengirim menu nonaktif atau layar yang tidak terdaftar sebagai pilihan navigasi yang dapat dibuka.

## Di Luar Lingkup

- Membuat layar, endpoint, atau fitur domain dari CMS.
- Menambahkan item CMS global atau mengganti sidebar CMS saat ini.
- Menyimpan URL eksternal atau path bebas sebagai tujuan menu.
- Mengatur role dan permission pengguna akhir mobile. Permission F05 pada F14 hanya membatasi admin CMS yang mengelola konfigurasi menu.
- Membuat rute baru tersedia pada aplikasi yang sudah dirilis tanpa pengembangan dan distribusi versi mobile yang memuat rute tersebut.

## Kriteria Selesai Backend Tahap Pertama

1. CRUD GraphQL menyimpan dan membaca menu pada control-plane untuk aplikasi dalam konteks `X-App-Slug` yang tervalidasi.
2. API menolak slug duplikat dalam satu aplikasi, parent dari aplikasi lain, relasi parent yang bersiklus, dan `route_key` atau `icon_key` yang melanggar format identifier.
3. Permission app-scoped F05 melindungi query dan setiap mutation; Super Admin bypass, admin tanpa permission ditolak meski memanggil API langsung.
4. Perubahan menu menghasilkan audit log dengan pelaku dan aplikasi yang benar.
5. Migrasi dapat di-rollback tanpa mengubah tabel atau data aplikasi lain.

## Kriteria Selesai F14

1. Super Admin dapat mengatur menu untuk aplikasi A tanpa mengubah menu aplikasi B.
2. API menolak slug duplikat dalam satu aplikasi, parent dari aplikasi lain, relasi parent yang bersiklus, dan `route_key` yang belum terdaftar.
3. API mengembalikan hanya menu aktif untuk aplikasi yang diminta, dalam bentuk hierarki dan urutan yang konsisten.
4. Admin dengan `.view` tetapi tanpa `.create` dapat membuka halaman namun tidak dapat membuat menu, termasuk melalui API langsung.
5. Admin dengan `.update` dapat mengubah atau mengurutkan menu hanya pada aplikasi yang ditetapkan role-nya; tanpa `.delete`, admin tidak dapat menghapus menu. Super Admin tetap dapat melakukan semua aksi.
6. Form Role mengelompokkan permission F14 di bawah menu CMS Menu Mobile dan menyimpan assignment lewat `role_permissions`.
7. Perubahan menu menghasilkan audit log dengan pelaku dan aplikasi yang benar.
8. Klien mobile menampilkan menu yang cocok dengan layar di source-nya; permission CMS admin tidak memengaruhi pengguna mobile.
9. Mengubah menu CMS atau berpindah app context CMS tidak mengubah konfigurasi menu mobile aplikasi lain.

## Keputusan untuk Implementasi

- F14 mengelola menu mobile per aplikasi; sidebar CMS tetap statis seperti sekarang.
- Konfigurasi berada di control-plane DB karena Super Admin mengelola beberapa aplikasi.
- Menu hanya merujuk ke layar dan ikon terdaftar. Penambahan layar tetap merupakan perubahan source mobile.
- Admin CMS memakai RBAC F05 dengan permission app-scoped `platform.mobile-menus.view/create/update/delete`; role UI mengelompokkannya di bawah menu Menu Mobile. Penyimpanan role-permission dan enforcement server tetap memakai mekanisme F05.
- Tombol UI dipetakan ke permission yang sama dengan mutation API. Super Admin bypass; `.manage` mengikuti aturan ekspansi yang sudah dipakai F05.
- Permission tersebut tidak mengatur akses pengguna akhir mobile. RBAC pengguna mobile memerlukan rancangan terpisah.
- Aplikasi mobile mengambil konfigurasi secara runtime dari API platform, bukan dari konfigurasi yang dibundel saat build.
- F13 menerbitkan manifest route dan icon untuk tiap aplikasi. API memvalidasi sesi user melalui adapter F13 dan mengembalikan menu untuk aplikasi sesi tersebut saja.
- Backend aplikasi tidak boleh membaca tabel control-plane secara langsung.
- Sinkronkan FR baru, skema, dan kontrak API ke PRD serta dokumen arsitektur saat implementasi dimulai.

## Referensi

- [F03: Registry & Provisioning Aplikasi](F03-registry-provisioning.md)
- [F05: RBAC Dinamis](F05-rbac-dinamis.md)
- [F06: Audit Log](F06-audit-log.md)
- [F13: Generator Aplikasi Mobile](F13-generator-aplikasi-mobile.md)
- [docs/06-database-design.md](../docs/06-database-design.md)
