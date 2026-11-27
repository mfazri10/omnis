"use client";

import { Fragment } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { appMenu } from "@/features/shell/menu";
import type { MenuItem } from "@/features/shell/menu";
import { GLOBAL_MENU } from "@/features/shell/menu";
import { CMS_PICKER_PATH } from "@/features/shell/routes";
import { useSessionStore } from "@/stores/use-session-store";

export interface BreadcrumbItem {
  label: string;
  href: string | null;
}

export interface BreadcrumbApp {
  slug: string;
  name: string;
  modules?: string[];
}

const PLATFORM_CONTEXT: BreadcrumbItem = {
  label: "Platform",
  href: CMS_PICKER_PATH,
};

const STATIC_LABELS: Record<string, string> = {
  "/platform/pilih-aplikasi": "Pilih aplikasi",
  "/platform/apps/new": "Aplikasi baru",
  "/platform/admins/new": "Admin baru",
  "/platform/roles/new": "Role baru",
  "/profile/change-password": "Ubah kata sandi",
};

const DYNAMIC_LABELS: ReadonlyArray<[prefix: string, label: string]> = [
  ["/platform/admins/", "Detail admin"],
  ["/platform/roles/", "Detail role"],
  ["/platform/apps/", "Detail aplikasi"],
];

function matchMenu(items: MenuItem[], pathname: string): MenuItem | null {
  for (const item of items) {
    if (item.href === null) {
      continue;
    }
    // Aturan aktif yang sama dengan MenuList di sidebar.
    const exact = pathname === item.href;
    const active =
      exact || (item.key !== "dashboard" && pathname.startsWith(`${item.href}/`));
    if (active) {
      return item;
    }
  }
  return null;
}

export function buildBreadcrumb(
  pathname: string,
  apps: ReadonlyArray<BreadcrumbApp>,
): BreadcrumbItem[] {
  const staticLabel = STATIC_LABELS[pathname];
  if (staticLabel !== undefined) {
    if (pathname === CMS_PICKER_PATH) {
      return [{ label: staticLabel, href: null }];
    }
    return [PLATFORM_CONTEXT, { label: staticLabel, href: null }];
  }

  if (pathname.startsWith("/platform") || pathname.startsWith("/profile/")) {
    const dynamicMatch = DYNAMIC_LABELS.find(([prefix]) =>
      pathname.startsWith(prefix),
    );
    if (dynamicMatch !== undefined) {
      return [PLATFORM_CONTEXT, { label: dynamicMatch[1], href: null }];
    }
    const menuMatch = matchMenu(GLOBAL_MENU, pathname);
    if (menuMatch !== null) {
      return [PLATFORM_CONTEXT, { label: menuMatch.label, href: null }];
    }
    return [PLATFORM_CONTEXT];
  }

  const slug = pathname.split("/")[1] ?? "";
  const app = apps.find((candidate) => candidate.slug === slug);
  if (app === undefined) {
    return [];
  }
  const context: BreadcrumbItem = { label: app.name, href: `/${app.slug}` };
  const menuMatch = matchMenu(
    appMenu(app.slug, app.modules ?? []),
    pathname,
  );
  if (menuMatch === null) {
    return [context];
  }
  return [context, { label: menuMatch.label, href: null }];
}

export function Breadcrumbs(): JSX.Element {
  const pathname = usePathname();
  const apps = useSessionStore((state) => state.accessibleApps);
  const items = buildBreadcrumb(pathname ?? "/", apps);
  if (items.length === 0) {
    return <></>;
  }
  return (
    <Breadcrumb aria-label="Breadcrumb">
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={item.label}>
            <BreadcrumbItem>
              {item.href === null ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={item.href} />}>
                  {item.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < items.length - 1 && <BreadcrumbSeparator />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
