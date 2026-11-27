# Desain: Integrasi Produksi untuk Platform

## Tujuan

Menutup gap antara alur CMS yang sudah ada dan layanan yang harus benar-benar bekerja saat produksi: email transaksional, object storage S3-compatible, push Firebase Cloud Messaging, serta pemrosesan job yang tetap berjalan terpisah dari siklus hidup request API. Verifikasi browser akan memastikan alur CMS yang terdampak tetap bisa dipakai.

## Kondisi Saat Ini

- Email memakai Nodemailer, tetapi bila SMTP tidak ada, service mencetak isi pesan ke log dan menganggap pengiriman berhasil.
- Media memakai `LocalStorageDriver`; abstraksi `StorageDriver` sudah ada, tetapi controller penyaji media terikat langsung ke driver lokal.
- Push memakai `NoopPushSender`, yang mengembalikan hasil `sent`; kredensial FCM per aplikasi sudah dienkripsi di control-plane.
- Kampanye notifikasi dan job ekspor diproses oleh interval in-process di API. Keduanya sudah memiliki klaim bersyarat di database.
- PostgreSQL dan Redis development hidup. API/CMS belum berjalan. Browser Playwright belum terpasang. Database lokal yang ada tidak akan dipakai untuk uji mutasi tanpa fixture terisolasi.

## Pendekatan yang Dipilih

1. **Integrasi nyata untuk produksi, fallback lokal hanya untuk development.** Tambahkan driver FCM melalui Firebase Admin SDK, driver S3-compatible melalui AWS SDK for JavaScript, dan antrean persisten BullMQ. Nodemailer tetap digunakan untuk SMTP. Abstraksi yang sudah ada dipertahankan agar layanan domain tidak terikat provider.
2. **Perketat perilaku fallback.** Memperbaiki status `sent` palsu, mewajibkan SMTP saat produksi, dan mempertahankan media lokal serta runner in-process. Ini lebih kecil, tetapi tidak menutup kebutuhan FCM, object storage, atau job yang bertahan melewati restart.

Pendekatan pertama dipilih karena permintaan mencakup kesiapan jalur produksi. Mode development tetap bisa berjalan tanpa kredensial cloud. Produksi harus gagal saat startup jika SMTP, S3, atau kunci FCM diperlukan tetapi belum dikonfigurasi.

## Desain

### Email

- Pertahankan `EmailService` dan Nodemailer.
- Stub konsol hanya boleh aktif di development/test. Di production, ketiadaan SMTP menghasilkan kegagalan startup atau error eksplisit sebelum email dianggap terkirim.
- Tidak ada kredensial SMTP yang ditambahkan ke repo.

### Object storage

- Tambahkan `S3StorageDriver` di belakang `StorageDriver`, dikonfigurasi melalui endpoint, region, bucket, access key, secret key, dan public base URL.
- `LocalStorageDriver` tetap menjadi driver default development.
- Upload dan delete memakai kontrak yang sama. URL publik dibentuk dari public base URL yang dikonfigurasi.
- Ubah route GET media lokal agar hanya dipakai saat driver lokal aktif; S3 tidak mengandalkan filesystem API.
- Produksi gagal startup bila driver S3 dipilih tetapi konfigurasinya tidak lengkap.

### Push dan job

- Pertahankan bentuk payload push; driver FCM menerima identitas aplikasi beserta kredensial yang sudah didekripsi server-side.
- Setiap Firebase app di-cache per aplikasi dan kredensial, cache lama dibersihkan saat rotasi, lalu semua app ditutup saat worker berhenti.
- Mode `noop` tetap tersedia untuk development, namun kampanye harus berakhir dengan status `simulated`, bukan `sent`. Statistik harus membedakan simulasi dari pengiriman nyata melalui `simulated_count`.
- Hasil push ambigu (FCM mungkin menerima pesan, tetapi worker tidak menerima atau menyimpan konfirmasi) berakhir dengan status `unknown` dan tidak dikirim ulang otomatis. Error yang secara tegas menyatakan FCM tidak menerima pesan menjadi gagal terminal; operator dapat membedakan dan meninjau hasil `unknown`.
- Simpan agregat hasil per token; hapus token hanya jika FCM secara eksplisit menyatakannya tidak valid.
- Pindahkan pemindaian kampanye jatuh tempo dan pemrosesan ekspor ke worker BullMQ terpisah. API tetap mencatat perubahan domain; worker melakukan klaim database bersyarat dan eksekusi job yang idempotent. Retry dan kegagalan terminal memperbarui status domain serta audit log tanpa mengirim ulang target yang sudah terkirim atau hasilnya ambigu.
- Worker menjalankan rekonsiliasi periodik untuk menemukan kampanye/job yang tertinggal setelah restart. Worker menyimpan target dan memperbarui heartbeat kampanye selama pengiriman. Jika lease pengiriman melewati 10 menit, sisa target dihitung sebagai `unknown`; kampanye tidak di-retry otomatis.
- Tambahkan script untuk menjalankan worker terpisah. Mode test mematikan scheduler otomatis.

### Verifikasi CMS

- Jalankan API dan CMS terhadap database development yang terisolasi atau database sementara.
- Siapkan akun admin fixture dan jalankan click-through untuk login, app switcher, daftar/detail aplikasi, RBAC, media, kampanye, dan halaman CBT yang tersedia.
- Jalankan pemeriksaan desktop dan viewport mobile, catat screenshot/console/network error, dan hapus fixture setelah verifikasi.
- Uji integrasi provider memakai mock/local endpoint; tidak mengirim email, push, atau file ke akun produksi.

## Sasaran dan Bukan Sasaran

**Sasaran:** driver provider yang bisa dikonfigurasi, job tahan restart, fallback development yang jujur, verifikasi alur CMS, dan dokumentasi env yang sinkron.

**Bukan sasaran:** membuat akun Firebase/S3/SMTP, menerapkan infrastruktur cloud, menaruh secret di repo, mengirim ke pengguna sungguhan, atau membuat aplikasi mobile.

## Urutan Implementasi

1. Isolasi environment dan jalankan click-through CMS yang aman; catat blocker browser.
2. Kunci kontrak driver serta validasi konfigurasi production untuk email dan storage.
3. Tambahkan driver FCM serta status hasil yang membedakan simulasi dan pengiriman nyata.
4. Migrasikan kampanye dan ekspor ke worker BullMQ dengan retry, rekonsiliasi, dan shutdown bersih.
5. Perbarui panduan environment/deployment dan jalankan typecheck, lint, test, build, serta verifikasi browser yang mencakup perubahan.

## Risiko dan Mitigasi

- **Secret tidak tersedia di mesin ini:** verifikasi memakai mock dan fixture; kode menyediakan konfigurasi tanpa menyimpan secret.
- **Job ganda saat retry:** semua eksekusi memakai ID job deterministik dan klaim/status bersyarat database.
- **Driver lokal tidak cocok untuk produksi multi-instance:** konfigurasi production menolak driver lokal.
- **Pengiriman FCM sebagian berhasil atau ambigu setelah crash:** simpan agregat per token dan hapus hanya token yang secara eksplisit tidak valid. Jangan kirim ulang target yang sudah terkirim atau ambigu; recovery mengubah target yang tidak tercatat sebagai terkirim/gagal menjadi `unknown` untuk ditinjau operator.
- **Uji browser memodifikasi data lokal:** gunakan database fixture terpisah dan bersihkan setelah selesai.
