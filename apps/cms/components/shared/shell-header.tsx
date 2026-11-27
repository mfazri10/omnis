"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { JSX } from "react";
import { authClient } from "../../lib/auth-client";
import { useSessionStore } from "../../stores/use-session-store";
import { AppSwitcher } from "./app-switcher";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { CMS_PICKER_PATH } from "@/features/shell/routes";

export function ShellHeader(): JSX.Element {
  const router = useRouter();
  const admin = useSessionStore((state) => state.admin);
  const reset = useSessionStore((state) => state.reset);
  const { isMobile, openMobile, open } = useSidebar();

  async function handleLogout(): Promise<void> {
    await authClient.signOut();
    reset();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-border bg-card px-4 py-2.5 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:px-6">
      <SidebarTrigger id="cms-sidebar-trigger" className="col-start-1 row-start-1 size-11" aria-label="Menu utama"
        aria-expanded={isMobile ? openMobile : open} />
      <Link className="col-start-2 row-start-1 inline-flex min-h-11 items-center text-sm font-semibold tracking-tight" href={CMS_PICKER_PATH}>
        CMS Platform
      </Link>
      <div className="col-span-3 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-1">
        <AppSwitcher />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" className="col-start-3 row-start-1 min-h-11 sm:col-start-4" />}>
          Akun
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
          <DropdownMenuGroup>
            {admin?.email && <DropdownMenuLabel className="whitespace-normal wrap-anywhere">{admin.email}</DropdownMenuLabel>}
            <DropdownMenuItem className="min-h-11" render={<Link href="/profile/change-password" />}>
              Ubah kata sandi
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11" onClick={() => void handleLogout()}>Keluar</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
