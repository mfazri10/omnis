import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarClock,
  ClipboardCheck,
  FileQuestion,
  Images,
  LayoutDashboard,
  ListTree,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Smartphone,
  UserCog,
  Users,
} from "lucide-react";

export interface MenuItem {
  key: string;
  label: string;
  /** null = belum ada rutenya (status "soon"). */
  href: string | null;
  /** Permission agar item tampil; null = tampil untuk semua admin login. */
  requires: string | null;
  status: "live" | "soon";
  /** Ikon lucide; makna tindakan, label tetap pembawa makna utama. */
  icon: LucideIcon;
}

export const GLOBAL_MENU: MenuItem[] = [
  {
    key: "dashboard",
    label: "Dasbor",
    icon: LayoutDashboard,
    href: "/platform/dashboard",
    requires: "platform.apps.view",
    status: "live",
  },
  {
    key: "apps",
    label: "Aplikasi",
    icon: Smartphone,
    href: "/platform/apps",
    requires: "platform.apps.view",
    status: "live",
  },
  {
    key: "admins",
    label: "Admin",
    icon: UserCog,
    href: "/platform/admins",
    requires: "platform.admins.view",
    status: "live",
  },
  {
    key: "roles",
    label: "Role",
    icon: ShieldCheck,
    href: "/platform/roles",
    requires: "platform.roles.view",
    status: "live",
  },
  {
    key: "audit-log",
    label: "Audit Log",
    icon: ScrollText,
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
      icon: LayoutDashboard,
      href: `/${slug}`,
      requires: null,
      status: "live",
    },
    {
      key: "users",
      label: "Pengguna",
      icon: Users,
      href: `/${slug}/users`,
      requires: "platform.users.view",
      status: "live",
    },
    {
      key: "media",
      label: "Media",
      icon: Images,
      href: `/${slug}/media`,
      requires: "platform.media.view",
      status: "live",
    },
    {
      key: "notifications",
      label: "Notifikasi",
      icon: Bell,
      href: `/${slug}/notifications`,
      requires: "platform.notifications.view",
      status: "live",
    },
    {
      key: "menu-mobile",
      label: "Menu Mobile",
      icon: ListTree,
      href: `/${slug}/menu-mobile`,
      requires: "platform.mobile-menus.view",
      status: "live",
    },
    {
      key: "settings",
      label: "Pengaturan",
      icon: Settings,
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
        icon: FileQuestion,
        href: `/${slug}/cbt/soal`,
        requires: "cbt.questions.view",
        status: "live",
      },
      {
        key: "cbt-paket",
        label: "Paket CBT",
        icon: Package,
        href: `/${slug}/cbt/paket`,
        requires: "cbt.packages.view",
        status: "live",
      },
      {
        key: "cbt-sesi",
        label: "Sesi CBT",
        icon: CalendarClock,
        href: `/${slug}/cbt/sesi`,
        requires: "cbt.sessions.view",
        status: "live",
      },
      {
        key: "cbt-hasil",
        label: "Hasil CBT",
        icon: ClipboardCheck,
        href: `/${slug}/cbt/hasil`,
        requires: "cbt.results.view",
        status: "live",
      },
    );
  }
  return items;
}
