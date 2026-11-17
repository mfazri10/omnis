"use client";

import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { authClient } from "../../lib/auth-client";
import { useSessionStore } from "../../stores/use-session-store";
import { AppSwitcher } from "./app-switcher";

export function ShellHeader(): JSX.Element {
  const router = useRouter();
  const admin = useSessionStore((state) => state.admin);
  const reset = useSessionStore((state) => state.reset);

  async function handleLogout(): Promise<void> {
    await authClient.signOut();
    reset();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-slate-200 pb-4">
      <div className="flex items-center gap-4">
        <a className="text-sm font-bold text-slate-900" href="/">
          CMS Platform
        </a>
        <AppSwitcher />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-900">{admin?.email}</span>
        <a className="underline" href="/profile/change-password">
          Ubah kata sandi
        </a>
        <button
          type="button"
          className="underline"
          onClick={() => void handleLogout()}
        >
          Keluar
        </button>
      </div>
    </header>
  );
}
