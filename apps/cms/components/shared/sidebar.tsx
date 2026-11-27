"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { GLOBAL_MENU, appMenu } from "../../features/shell/menu";
import type { MenuItem } from "../../features/shell/menu";
import { useSessionStore } from "../../stores/use-session-store";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { CMS_PICKER_PATH } from "@/features/shell/routes";
import { Button } from "@/components/ui/button";

function isVisible(
  item: MenuItem,
  isSuperAdmin: boolean,
  permissions: string[],
): boolean {
  if (item.requires === null || isSuperAdmin) {
    return true;
  }
  return permissions.includes(item.requires);
}

function MenuList({ items }: { items: MenuItem[] }): JSX.Element {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {items.map(({ href, key, label }) => {
        if (href === null) return null;
        const exact = pathname === href;
        const active = exact || (key !== "dashboard" && pathname.startsWith(`${href}/`));
        return (
          <SidebarMenuItem key={key}>
            <SidebarMenuButton
              isActive={active}
              className="min-h-11 rounded-md"
              render={<Link href={href} aria-current={exact ? "page" : undefined}
                onClick={() => setOpenMobile(false)} />}
            >
              {label}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function CmsSidebar(): JSX.Element {
  const { isMobile, open, setOpenMobile } = useSidebar();
  const { appSlug } = useParams<{ appSlug?: string }>();
  const admin = useSessionStore((state) => state.admin);
  const permissions = useSessionStore((state) => state.permissions);
  const activeSlug = useSessionStore((state) => state.activeSlug);
  const apps = useSessionStore((state) => state.accessibleApps);
  const permissionsContext = useSessionStore((state) => state.permissionsContext);
  const isSuperAdmin = admin?.isSuperAdmin ?? false;
  const currentPermissions = permissionsContext === (appSlug ?? "global") ? permissions : [];
  const globalItems = GLOBAL_MENU.filter((item) => isVisible(item, isSuperAdmin, currentPermissions));
  const activeApp = appSlug === activeSlug && activeSlug === permissionsContext
    ? apps.find((app) => app.slug === activeSlug) ?? null : null;
  const contextItems =
    activeApp === null
      ? []
      : appMenu(activeApp.slug, activeApp.modules).filter((item) =>
          isVisible(item, isSuperAdmin, permissions),
        );
  return (
    <Sidebar mobileTitle="Menu utama" mobileDescription="Navigasi platform dan aplikasi"
      mobileFinalFocus={() => document.getElementById("cms-sidebar-trigger")}>
      <SidebarHeader inert={!isMobile && !open} className="flex-row items-center justify-between border-b border-sidebar-border px-4 py-2">
        <Link href={CMS_PICKER_PATH} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
          onClick={() => setOpenMobile(false)}>
          <span aria-hidden="true" className="h-4 w-1 rounded-sm bg-primary" />
          Pilih aplikasi
        </Link>
        {isMobile && <Button type="button" variant="ghost" className="min-h-11"
          onClick={() => setOpenMobile(false)}>Tutup menu</Button>}
      </SidebarHeader>
      <SidebarContent inert={!isMobile && !open}>
        <nav aria-label="Menu utama">
          {globalItems.length > 0 && <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <MenuList items={globalItems} />
          </SidebarGroup>}
          {activeApp && <SidebarGroup>
            <SidebarGroupLabel className="h-auto min-h-8 whitespace-normal wrap-anywhere">{activeApp.name}</SidebarGroupLabel>
            <MenuList items={contextItems} />
          </SidebarGroup>}
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
