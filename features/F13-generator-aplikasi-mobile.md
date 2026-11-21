# F13: Generator Aplikasi Mobile, Backend, Database, dan Auth

| Item | Detail |
|---|---|
| Status implementasi | Belum mulai; dokumen kebutuhan, bukan bukti fitur tersedia |
| Prioritas | Must untuk alur generator |
| Tanggal | 21 November 2026 |
| Pengguna awal | Developer/pengelola instalasi open-source, bukan pelanggan SaaS |
| Dependensi | F00, F01, F02, F03, F05; integrasi manajemen user F08 |
| Referensi kebutuhan | FR-GEN-01 sampai FR-GEN-14 dalam dokumen ini |

## 1. Tujuan dan hasil yang diharapkan

Developer cukup mengisi identitas aplikasi, memilih template backend dan template mobile yang kompatibel, lalu menjalankan pembuatan. Platform menghasilkan database terisolasi, source code backend dan mobile yang saling terhubung, serta auth end-to-end bawaan template. Aplikasi tercatat di CMS pusat agar dapat dikelola tanpa membuat ulang fondasi dashboard admin.

Auth bukan sekadar halaman login: template harus menyertakan alur UI mobile, integrasi API, penyimpanan sesi aman, skema database, dan pengujian. Hasil generator adalah source code yang dapat dimiliki, dijalankan, dan dikembangkan sendiri.

Produk ditujukan sebagai proyek open-source/self-hosted. Billing, subscription, checkout, paket berbayar, dan pembatasan fitur berdasarkan pembayaran tidak termasuk kebutuhan.

## 2. Hubungan dengan rancangan dan kode sekarang

- F03 sudah menyediakan registry, pembuatan App DB, migrasi dasar, config awal, status, kompensasi, dan retry. Perluas alur tersebut; jangan membuat registry/provisioner kedua yang saling tumpang tindih.
- Form lama hanya mengirim nama, slug, dan catatan. Wizard UI yang dibuat pada branch `feature/F03-wizard-buat-aplikasi` belum berarti generator backend/mobile tersedia atau sudah masuk `main-features`.
- `app-template` pada migrasi saat ini berarti template skema database, bukan katalog template source code backend/mobile.
- Backend sekarang menolak `modules` yang tidak kosong. Dokumen ini tidak menganggap instalasi modul domain sudah tersedia.
- Dokumen stack saat ini mengunci backend platform pada NestJS + GraphQL + better-auth. Pilihan template backend aplikasi adalah perluasan kebutuhan dan tidak mengubah stack CMS/control-plane secara otomatis.
- NestJS bersama yang tersedia sekarang berbeda dari generator proyek NestJS mandiri. UI wajib menjelaskan perbedaan hasil keduanya.
- Dokumen ini menetapkan target pengembangan baru, bukan mengganti keputusan stack lama secara diam-diam. Sinkronisasi arsitektur, database, API, roadmap, dan strategi provisioning menjadi bagian pekerjaan implementasi sebelum fitur dinyatakan selesai.

## 3. Batas lingkup

### Wajib

1. Wizard identitas, pemilihan template backend/mobile, ringkasan, eksekusi, dan hasil.
2. Katalog template berversi dengan pemeriksaan kompatibilitas.
3. Database terpisah per aplikasi, source backend dan mobile, auth terintegrasi, serta panduan menjalankan hasilnya.
4. Progres nyata tersimpan di server; detail kegagalan dan retry yang aman.
5. Registry dan akses pengelolaan aplikasi melalui CMS pusat.
6. Pengembangan lanjutan melalui source code tanpa ketergantungan pada layanan komersial wajib.

### Di luar lingkup awal

- Billing, subscription, dan marketplace berbayar.
- Generator tanpa batas untuk semua framework/bahasa.
- Publikasi otomatis ke Play Store/App Store, signing produksi, dan pembuatan akun penyedia layanan.
- Hosting/deployment produksi otomatis. Pembuatan source, build pengujian, deployment, dan publikasi store adalah status berbeda.
- Eksekusi template tidak tepercaya yang diunggah sembarang pengguna.
- Semua modul bisnis otomatis tersedia. CBT/POS/Debat memerlukan spesifikasi dan implementasi modul masing-masing.

## 4. Alur pengguna

1. **Identitas:** nama, slug, dan catatan opsional. Identitas Android/iOS memiliki nilai awal yang valid dan dapat disunting bila template memerlukannya.
2. **Template backend:** tampilkan stack, versi, auth, database, mode runtime, prasyarat, serta hasil yang dihasilkan.
3. **Template mobile:** tampilkan framework, versi, target Android/iOS, dan pasangan backend yang didukung. Auth bawaan aktif tanpa perlu merakit integrasi manual.
4. **Ringkasan:** tampilkan identitas, nama DB, versi template, kemampuan auth, output, konfigurasi yang masih diperlukan, serta pernyataan bahwa belum ada deployment/publikasi store.
5. **Buat aplikasi:** server membuat generation job, menjalankan provisioning/generator, dan melaporkan langkah aktual. Klik ganda tidak membuat job/resource duplikat.
6. **Hasil:** tampilkan status DB/backend/mobile/auth secara terpisah, unduhan source code, panduan menjalankan, dan tautan detail/CMS aplikasi. Jika gagal, tampilkan langkah yang gagal dan aksi pemulihannya.

## 5. Functional Requirements

### FR-GEN-01: Identitas dan validasi

- Wajib nama dan slug; slug unik dan tervalidasi di server, bukan hanya browser.
- Slug dapat disarankan dari nama. Validasi mengikuti batas nama DB setelah prefix/normalisasi, serta mendeteksi benturan seperti `my-app` dan `my_app` bila normalisasi menghasilkan nama DB sama.
- Identitas package/bundle harus valid sesuai template. Nilai awal tidak boleh disajikan sebagai identitas publikasi store yang sudah terdaftar.
- Kembali ke langkah sebelumnya tidak menghapus input dan tidak membuat resource.

### FR-GEN-02: Katalog template berversi

- Setiap template memiliki ID, versi, jenis backend/mobile, deskripsi, lisensi, runtime/framework, persyaratan, kemampuan auth, versi kontrak API, dan dukungan database.
- Gunakan manifest kompatibilitas yang dapat dibaca mesin, bukan daftar pilihan statis yang terpisah antara UI dan server.
- Hanya template yang benar-benar memiliki implementasi dan lulus pengujian yang dapat dipilih. Template rencana diberi label belum tersedia dan tidak dapat disubmit.
- Versi template dan generator dipatok untuk setiap generation job agar retry tidak diam-diam memakai template terbaru.

### FR-GEN-03: Validasi pasangan template

- Server memvalidasi kompatibilitas backend, mobile, auth, database, dan versi kontrak sebelum membuat resource.
- Kombinasi tidak kompatibel ditolak dengan alasan dan alternatif yang valid.
- UI menjelaskan apakah backend memakai runtime bersama atau source proyek mandiri. Pilihan backend tidak boleh diabaikan lalu selalu menghasilkan NestJS bersama.

### FR-GEN-04: Auth bawaan template

- Paket template menyertakan registrasi, login email/kata sandi, logout, pemulihan sesi, profil pengguna aktif, layar terlindungi, lupa/reset kata sandi, dan verifikasi email.
- Backend melakukan validasi input, hashing kata sandi melalui pustaka auth yang terawat, pembatasan percobaan, kedaluwarsa sesi/token, serta pencabutan sesi sesuai kemampuan provider yang dipilih.
- Mobile menggunakan penyimpanan aman OS untuk kredensial sesi, bukan penyimpanan biasa atau secret yang tertanam dalam bundle. Jangan membawa sesi cookie admin CMS ke aplikasi mobile.
- Identitas admin platform tetap terpisah dari pengguna aplikasi. User aplikasi A tidak otomatis menjadi user aplikasi B.
- Detail implementasi auth mengikuti adapter template. Jangan mengasumsikan better-auth dapat dipakai langsung pada semua bahasa backend, termasuk Go.
- Template wajib menyediakan kontrak dan contoh integrasi auth yang sudah cocok. Tidak menambahkan pilihan auth terpisah yang memaksa pengguna merakit ulang pasangan backend/mobile.
- Untuk pengembangan, alur email boleh memakai penangkap email lokal. Produksi memerlukan konfigurasi email sendiri; UI/README menjelaskan batas ini tanpa mengklaim email terkirim bila penyedia belum dikonfigurasi.

### FR-GEN-05: Provisioning database

- Buat App DB terisolasi dan jalankan migrasi dasar, auth, serta migrasi template yang dipilih sebelum menyatakan DB siap.
- Kredensial runtime dibatasi ke App DB terkait; kredensial superuser/provisioner tidak diberikan ke mobile atau source hasil unduhan.
- Catat DB/resource yang dibuat oleh job agar cleanup hanya menyasar resource milik job tersebut.
- Kegagalan dan timeout tidak boleh menyebabkan retry menghapus DB aktif atau data milik aplikasi lain.

### FR-GEN-06: Source backend

- Hasilkan source backend sesuai pilihan, manifest dependensi/lockfile, konfigurasi environment contoh tanpa secret, migrasi, endpoint auth/profil/health, test dasar, dan README.
- Source dapat dijalankan mandiri sesuai mode yang dijanjikan template, tidak berisi handler palsu yang selalu mengembalikan sukses.
- Endpoint dan kontrak yang digunakan mobile tersedia di backend. Kredensial aplikasi tidak dicampur dengan akses admin CMS.
- Pengisian secret runtime berlangsung melalui konfigurasi aman; source archive tidak memuat password DB aktif atau token instalasi.

### FR-GEN-07: Source mobile

- Hasilkan proyek mobile sesuai template dengan identitas aplikasi, konfigurasi base URL/API, layar auth, navigasi terlindungi, profil, logout, dan penanganan loading/error.
- Sertakan petunjuk URL backend untuk emulator Android, simulator iOS, dan perangkat fisik. Jangan menanam `localhost` sebagai endpoint yang dianggap valid untuk semua perangkat.
- Hindari dependensi yang mewajibkan langganan komersial untuk menjalankan fungsi inti.
- Hasil minimum berupa source siap pengembangan, bukan APK/IPA bertanda tangan atau aplikasi yang sudah dipublikasikan.

### FR-GEN-08: Integrasi CMS

- Daftarkan identitas, template/version, mode backend, status resource, dan referensi endpoint aplikasi di control-plane.
- Akses admin terhadap aplikasi baru mengikuti RBAC platform, bukan diberikan melalui manipulasi state UI saja.
- Untuk backend terpisah, wajib ada adapter/kontrak pengelolaan agar CMS dapat memanggil fungsi yang didukung dengan autentikasi dan scope aplikasi yang benar. CMS tidak membaca sembarang tabel pada DB backend khusus.
- Auth/users dan informasi operasional dasar harus memiliki integrasi nyata sebelum template diberi label dapat dikelola melalui CMS.
- Menu bisnis khusus hanya muncul untuk modul yang benar-benar terpasang dan diizinkan.

### FR-GEN-09: Job dan progres nyata

- Pembuatan menghasilkan job ID dan kunci idempotensi. Job, langkah, percobaan, waktu, status, dan error tersimpan di server.
- Tahap minimum: validasi, registry, database, migrasi, generate backend, generate mobile, pemeriksaan hasil, pengemasan artifact, finalisasi.
- Model status job minimum: queued, running, succeeded, failed, compensation_failed. Langkah memiliki status pending/running/succeeded/failed/skipped.
- Refresh halaman dapat melanjutkan pemantauan job. Polling atau streaming diperbolehkan; progres tidak boleh berupa timer/persentase palsu.
- DB ready, source ready, runtime deployed, dan runtime healthy dicatat terpisah. Source berhasil dibuat tidak otomatis berarti runtime aktif.

### FR-GEN-10: Kegagalan, retry, dan cleanup

- Kegagalan menampilkan langkah, pesan aman, dan aksi yang sesuai. Secret tidak muncul dalam log/error UI.
- Retry menggunakan input/versi template yang sama dan melanjutkan atau mengulang tahap secara aman tanpa duplikasi registry/DB.
- Timeout permintaan browser tidak dianggap pembatalan pasti di server. Cek job/resource aktual sebelum mengulang.
- Kompensasi boleh membersihkan resource sementara yang dimiliki job, tetapi tidak menghapus data aplikasi aktif. Jika kompensasi gagal, catat cleanup_required dan sediakan pemulihan operasional.
- Jika DB sudah siap tetapi pembuatan mobile gagal, tampilkan hasil parsial dan pertahankan konteks pemulihan; jangan menyatakan semuanya berhasil.

### FR-GEN-11: Penyerahan hasil

- Sediakan archive source backend/mobile dan panduan menjalankan, termasuk migrasi, auth, email lokal, environment, dan testing.
- Sertakan generation manifest berisi pilihan dan versi tanpa secret. Jangan sertakan data pengguna, `node_modules`, cache build, atau kredensial aktif.
- Unduhan artifact harus berotorisasi dan tidak dapat diakses admin aplikasi lain tanpa hak.
- Jelaskan apakah artifact memerlukan CMS saat runtime; hindari lock-in tersembunyi pada fungsi inti aplikasi.

### FR-GEN-12: Pengembangan khusus

- Hasil kode memiliki batas yang jelas antara fondasi template dan fitur domain, berikut contoh penambahan endpoint, migrasi, layar mobile, dan integrasi halaman/menu CMS.
- Regenerate tidak boleh menimpa perubahan developer secara diam-diam. Versi awal cukup membuat output baru dengan manifest dan petunjuk perbandingan/perubahan manual.
- Pemasangan modul bisnis sesudah generate adalah pengembangan lanjutan, bukan janji semua kebutuhan dapat diselesaikan no-code.

### FR-GEN-13: Open-source dan self-hosted

- Sediakan panduan menjalankan platform/generator sendiri, prasyarat, konfigurasi, dan troubleshooting.
- Catat lisensi template serta dependensi dan kompatibilitas distribusi source hasil generator. Lisensi proyek/hasil harus ditetapkan pemilik proyek sebelum rilis, tidak diasumsikan oleh implementasi.
- Fungsi inti tidak bergantung pada billing, akun SaaS berbayar, atau license server komersial. Layanan eksternal opsional harus dijelaskan dan memiliki jalur konfigurasi self-hosted/lokal bila relevan.

### FR-GEN-14: Keamanan generator

- Hanya template tepercaya/terkurasi yang dieksekusi pada rilis awal. Jalankan proses build/generator terisolasi dengan batas waktu/resource.
- Jangan interpolasi nama/slug langsung ke shell, path, identifier SQL, atau nama proyek tanpa validasi/escaping yang tepat.
- Cegah path traversal dan overwrite file di luar workspace job. Backend aplikasi tidak menerima akses credential control-plane.

## 6. Kriteria penerimaan end-to-end

1. **Jalur sukses:** developer memasukkan identitas dan memilih pasangan template valid, lalu mendapat App DB, archive backend/mobile, auth terintegrasi, manifest versi, dan detail aplikasi di CMS tanpa menulis kode integrasi auth sendiri.
2. **Tidak ada side effect sebelum konfirmasi akhir:** berpindah langkah atau membuka ringkasan tidak membuat DB/job provisioning.
3. **Auth nyata:** proyek hasil generator dapat dijalankan sesuai README; registrasi, verifikasi email lokal, login, pemulihan sesi, profil, reset kata sandi, dan logout bekerja. Logout/sesi kedaluwarsa memblokir layar/API terlindungi.
4. **Isolasi:** akun/token aplikasi A ditolak pada aplikasi B; user aplikasi tidak memperoleh akses admin CMS. Kredensial runtime A tidak dapat membaca DB B atau control-plane.
5. **Kompatibilitas:** kombinasi template tidak valid ditolak server sebelum membuat resource, termasuk ketika permintaan dikirim tanpa UI.
6. **Idempotensi:** submit ganda menghasilkan satu job/resource; slug/nama DB duplikat tidak menghasilkan resource baru.
7. **Pemulihan:** simulasi kegagalan DB, migrasi, generator backend, generator mobile, packaging, dan kompensasi memperlihatkan status akurat; retry tidak menghapus DB aktif.
8. **Refresh:** pengguna menutup/memuat ulang halaman lalu kembali dan melihat status job yang sama, bukan menjalankan job baru.
9. **Kualitas output:** tiap pasangan template rilis lolos install dependensi, typecheck/lint/test sesuai stack, build backend, pemeriksaan build mobile sesuai platform, dan integration test auth. Toolchain Android/iOS yang diperlukan dicatat eksplisit.
10. **Tidak ada klaim deployment palsu:** tanpa deployment, hasil berlabel source siap dikembangkan, bukan aplikasi live/terbit di store.
11. **CMS:** admin berhak dapat membuka aplikasi baru dan fitur pengelolaan yang didukung setelah daftar akses diperbarui; admin tanpa hak tetap ditolak server.
12. **Keamanan artifact:** archive dan log tidak memuat credential aktif; unduhan tanpa izin ditolak.

## 7. Rekomendasi urutan implementasi

1. Tetapkan manifest template/kontrak auth dan selaraskan model data status dengan F03.
2. Bangun satu pasangan referensi sampai end-to-end, bukan banyak pilihan yang hanya berupa placeholder.
3. Tambahkan job persisten/idempotensi dan perluas provisioning secara aman.
4. Integrasikan wizard dengan katalog dan progres server, berikut archive hasil.
5. Uji dari instalasi self-hosted bersih sampai auth mobile berjalan, baru tambahkan template lain.

**Usulan pasangan pertama, belum keputusan terkunci:** NestJS + PostgreSQL + Expo/React Native, karena paling dekat stack sekarang. Go dan Flutter adalah kandidat perluasan, bukan template yang dianggap sudah tersedia.

## 8. Keputusan teknis yang masih perlu ditetapkan

- Pasangan backend/mobile pertama dan apakah backend hasil awal mandiri atau runtime bersama.
- Provider/adapter auth dan kontrak sesi untuk setiap pasangan, terutama bila Go didukung.
- Detail integrasi CMS untuk backend terpisah dan lifecycle migrasi DB-nya.
- Kebijakan retensi artifact, job, dan cleanup resource parsial.
- Lisensi proyek, template, dan hasil generator.

Poin terbuka tidak menghalangi penulisan FR ini, tetapi harus diputuskan sebelum implementasi bagian terkait dinyatakan selesai.

## Referensi

- [F03: Registry & Provisioning](F03-registry-provisioning.md)
- [F08: Manajemen User Aplikasi](F08-user-aplikasi.md)
- [Arsitektur Sistem](../docs/05-arsitektur-sistem.md)
- [Tech Stack](../docs/08-tech-stack.md)
- [Provisioning Saga](../docs/13-provisioning-saga.md)
