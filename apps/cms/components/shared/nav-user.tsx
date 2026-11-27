"use client";

import { ChevronsUpDown } from "lucide-react";
import type { JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { useSessionStore } from "@/stores/use-session-store";

function initialsOf(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

export function NavUser(): JSX.Element {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const admin = useSessionStore((state) => state.admin);
  const reset = useSessionStore((state) => state.reset);

  async function handleLogout(): Promise<void> {
    await authClient.signOut();
    reset();
    router.push("/login");
    router.refresh();
  }

  if (admin === null) {
    return <></>;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label="Akun"
                className="aria-expanded:bg-muted aria-expanded:text-foreground"
              />
            }
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
            >
              {initialsOf(admin.email)}
            </span>
            <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{admin.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {admin.email}
              </span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="ml-auto size-4 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <span className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                  >
                    {initialsOf(admin.email)}
                  </span>
                  <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{admin.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {admin.email}
                    </span>
                  </span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="min-h-11"
                render={
                  <Link
                    href="/profile/change-password"
                    onClick={() => setOpenMobile(false)}
                  />
                }
              >
                Ubah kata sandi
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11"
                onClick={() => {
                  setOpenMobile(false);
                  void handleLogout();
                }}
              >
                Keluar
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
