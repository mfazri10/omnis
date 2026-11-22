import type { PermissionDef } from "../platform/rbac/platform.permissions";

/**
 * Katalog permission modul CBT (F12, pola `modul.entitas.aksi`).
 * Disinkronkan ke tabel permissions saat boot oleh CbtModule sehingga
 * langsung muncul di layar Role (F05) dan bisa dirangkai jadi role
 * cakupan aplikasi tanpa perubahan kode lain. Semua globalOnly=false:
 * permission modul domain selalu terikat konteks aplikasi.
 */
export const CBT_CATALOG: PermissionDef[] = [
  { key: "cbt.questions.view", module: "cbt", label: "Melihat bank soal CBT", globalOnly: false },
  { key: "cbt.questions.manage", module: "cbt", label: "Mengelola bank soal CBT", globalOnly: false },
  { key: "cbt.packages.view", module: "cbt", label: "Melihat paket ujian CBT", globalOnly: false },
  { key: "cbt.packages.manage", module: "cbt", label: "Mengelola paket ujian CBT", globalOnly: false },
  { key: "cbt.sessions.view", module: "cbt", label: "Melihat sesi ujian CBT", globalOnly: false },
  { key: "cbt.sessions.manage", module: "cbt", label: "Menjalankan simulasi ujian CBT", globalOnly: false },
  { key: "cbt.results.view", module: "cbt", label: "Melihat hasil dan analitik CBT", globalOnly: false },
];
