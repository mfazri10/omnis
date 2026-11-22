export interface MenuItem {
  key: string;
  label: string;
  /** null = belum ada rutenya (status "soon"). */
  href: string | null;
  /** Permission agar item tampil; null = tampil untuk semua admin login. */
  requires: string | null;
  status: "live" | "soon";
}

export const GLOBAL_MENU: MenuItem[] = [
  {
    key: "dashboard",
    label: "Dasbor",
    href: "/platform/dashboard",
    requires: "platform.apps.view",
    status: "live",
  },
  {
    key: "apps",
    label: "Aplikasi",
    href: "/platform/apps",
    requires: "platform.apps.view",
    status: "live",
  },
  {
    key: "admins",
    label: "Admin",
    href: "/platform/admins",
    requires: "platform.admins.view",
    status: "live",
  },
  {
    key: "roles",
    label: "Role",
    href: "/platform/roles",
    requires: "platform.roles.view",
    status: "live",
  },
  {
    key: "audit-log",
    label: "Audit Log",
    href: "/platform/audit",
    requires: "platform.audit.view",
    status: "live",
  },
];

export function appMenu(slug: string, modules: string[] = []): MenuItem[] {
  const items: MenuItem[] = [
    {
      key: "dashboard",
      label: "Dasbor",
      href: `/${slug}`,
      requires: null,
      status: "live",
    },
    {
      key: "users",
      label: "Pengguna",
      href: `/${slug}/users`,
      requires: "platform.users.view",
      status: "live",
    },
    {
      key: "media",
      label: "Media",
      href: `/${slug}/media`,
      requires: "platform.media.view",
      status: "live",
    },
    {
      key: "notifications",
      label: "Notifikasi",
      href: `/${slug}/notifications`,
      requires: "platform.notifications.view",
      status: "live",
    },
    {
      key: "settings",
      label: "Pengaturan",
      href: `/${slug}/settings`,
      requires: "platform.app-config.view",
      status: "live",
    },
  ];
  // Menu modul domain hanya untuk aplikasi yang memasang modulnya
  // (F12: CBT). Permission tetap menyaring per admin.
  if (modules.includes("cbt")) {
    items.push(
      {
        key: "cbt-soal",
        label: "Soal CBT",
        href: `/${slug}/cbt/soal`,
        requires: "cbt.questions.view",
        status: "live",
      },
      {
        key: "cbt-paket",
        label: "Paket CBT",
        href: `/${slug}/cbt/paket`,
        requires: "cbt.packages.view",
        status: "live",
      },
      {
        key: "cbt-sesi",
        label: "Sesi CBT",
        href: `/${slug}/cbt/sesi`,
        requires: "cbt.sessions.view",
        status: "live",
      },
      {
        key: "cbt-hasil",
        label: "Hasil CBT",
        href: `/${slug}/cbt/hasil`,
        requires: "cbt.results.view",
        status: "live",
      },
    );
  }
  return items;
}
