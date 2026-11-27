# Arah visual CMS dan landing publik

CMS melayani admin yang beralih antar aplikasi dan mengerjakan tugas operasional berulang. Tampilan disepakati tenang dan padat dengan aksen teal. Landing memperkenalkan ruang kerja ke admin dan mengarahkan mereka melalui “Masuk CMS” ke `/login`. Setelah login, pemilih ada di `/platform/pilih-aplikasi`.

**Design read.** Ruang kerja admin dan halaman pengantar untuk pengelola aplikasi. ENERGY 1 / RHYTHM 2 / MOTION 1. Shell memberi ruang lebih luas untuk tabel, sedangkan halaman formulir memakai kolom yang lebih sempit agar label dan input dapat dibaca bersamaan.

- Teal dipakai pada aksi utama, fokus, dan penanda ruang kerja aktif. Status entitas memakai label yang bisa dibaca tanpa warna.
- Tipografi sistem menjaga ukuran dan bobot konsisten tanpa memerlukan font dari luar saat build. Metrik dan pagination memakai angka dengan lebar tetap.
- Judul dan aksi pertama mengarahkan perhatian. Garis tipis memisahkan bagian yang perlu dipindai, seperti aktivitas dan kolom hasil. Gerak dibatasi pada umpan balik kontrol dan transisi drawer.
- Landing memakai nama produk sebagai teks. Tiga alur yang dijelaskan tersedia di platform, yaitu akses aplikasi, media dan notifikasi, serta CBT untuk aplikasi yang memasangnya.
- Tautan publik tersedia langsung di header dan CTA utama. Footer memuat identitas produk. Shell CMS memusatkan navigasi pada sidebar, pemilih aplikasi, dan aksi sesi.
- Tidak ada kebutuhan isi atau navigasi khusus untuk `CmsFooter`; footer hanya dipakai pada landing publik.
- Fondasi shadcn/ui dipasang dengan CLI versi 4.23.1.
