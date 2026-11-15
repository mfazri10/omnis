export interface PermissionDef {
  key: string;
  module: string;
  label: string;
  description?: string;
  /** True = hanya boleh pada role cakupan global (doc 04). */
  globalOnly: boolean;
}

/** Katalog permission modul platform — di-seed ke tabel `permissions` saat boot. */
export const PLATFORM_CATALOG: PermissionDef[] = [
  { key: "platform.apps.view", module: "platform", label: "Melihat daftar aplikasi", globalOnly: true },
  { key: "platform.apps.manage", module: "platform", label: "Mengelola aplikasi dan provisioning", globalOnly: true },
  { key: "platform.roles.view", module: "platform", label: "Melihat role", globalOnly: true },
  { key: "platform.roles.manage", module: "platform", label: "Mengelola role dan penetapannya", globalOnly: true },
  { key: "platform.admins.view", module: "platform", label: "Melihat admin", globalOnly: true },
  { key: "platform.admins.manage", module: "platform", label: "Mengelola admin", globalOnly: true },
  { key: "platform.users.view", module: "platform", label: "Melihat user aplikasi", globalOnly: false },
  { key: "platform.users.manage", module: "platform", label: "Mengelola user aplikasi", globalOnly: false },
  { key: "platform.media.view", module: "platform", label: "Melihat media", globalOnly: false },
  { key: "platform.media.create", module: "platform", label: "Mengunggah media", globalOnly: false },
  { key: "platform.media.delete", module: "platform", label: "Menghapus media", globalOnly: false },
  { key: "platform.notifications.view", module: "platform", label: "Melihat kampanye notifikasi", globalOnly: false },
  { key: "platform.notifications.send", module: "platform", label: "Mengirim notifikasi", globalOnly: false },
  { key: "platform.app-config.view", module: "platform", label: "Melihat konfigurasi aplikasi", globalOnly: false },
  { key: "platform.app-config.manage", module: "platform", label: "Mengubah konfigurasi aplikasi", globalOnly: false },
  { key: "platform.audit.view", module: "platform", label: "Melihat log audit", globalOnly: false },
];

/**
 * Permission sensitif hanya untuk role global (doc 04 aturan 4):
 * `platform.apps.*`, `platform.roles.*`, `platform.admins.*`.
 */
export function isSensitivePermission(key: string): boolean {
  return (
    key.startsWith("platform.apps.") ||
    key.startsWith("platform.roles.") ||
    key.startsWith("platform.admins.")
  );
}
