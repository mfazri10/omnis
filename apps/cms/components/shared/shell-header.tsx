"use client";

import type { JSX } from "react";
import { AppSwitcher } from "./app-switcher";
import { Breadcrumbs } from "./breadcrumbs";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export function ShellHeader(): JSX.Element {
  const { isMobile, openMobile, open } = useSidebar();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="flex min-h-11 w-full items-center gap-2 px-4 py-2 sm:px-6">
        <SidebarTrigger id="cms-sidebar-trigger" className="size-11 shrink-0" aria-label="Menu utama"
          aria-expanded={isMobile ? openMobile : open} />
        <Separator
          orientation="vertical"
          className="data-vertical:h-4 data-vertical:self-auto"
        />
        <div className="hidden min-w-0 sm:flex">
          <Breadcrumbs />
        </div>
        <div className="min-w-0 flex-1" />
        <AppSwitcher />
      </div>
    </header>
  );
}
