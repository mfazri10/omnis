"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import type { JSX, ReactNode } from "react";
import { useEffect } from "react";
import { useToastStore } from "../../../stores/use-toast-store";
import { useSessionStore } from "../../../stores/use-session-store";
import { CMS_PICKER_PATH } from "@/features/shell/routes";

export default function AppSlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ appSlug: string }>;
}): JSX.Element {
  const { appSlug } = use(params);
  const router = useRouter();
  const ready = useSessionStore((state) => state.ready);
  const apps = useSessionStore((state) => state.accessibleApps);
  const activeSlug = useSessionStore((state) => state.activeSlug);
  const setActiveSlug = useSessionStore((state) => state.setActiveSlug);
  const pushToast = useToastStore((state) => state.push);

  useEffect(() => {
    if (!ready) {
      return;
    }
    // Hanya slug dikenal yang menjadi konteks; slug asing/tak berhak
    // dirender 403 inline oleh cabang di bawah tanpa menyentuh store
    // (satu pemilik untuk kasus tak dikenal: layout ini, bukan efek shell).
    const known = apps.some((app) => app.slug === appSlug);
    if (known) {
      setActiveSlug(appSlug);
    }
  }, [ready, appSlug, apps, setActiveSlug]);

  if (!ready) {
    return (
      <main className="mx-auto max-w-xl px-6 py-8 font-sans">
        <p className="text-slate-900">Menyiapkan sesi…</p>
      </main>
    );
  }
  const known = apps.some((app) => app.slug === appSlug);
  if (!known) {
    return (
      <main className="mx-auto max-w-xl px-6 py-8 font-sans">
        <h1 className="text-2xl font-bold text-slate-900">
          Anda tidak memiliki akses
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Aplikasi &ldquo;{appSlug}&rdquo; tidak ada atau berada di luar hak
          Anda.
        </p>
        <button
          type="button"
          className="mt-4 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            setActiveSlug(null);
            pushToast("Kembali ke pemilih aplikasi.");
            router.replace(CMS_PICKER_PATH);
          }}
        >
          Kembali ke pemilih aplikasi
        </button>
      </main>
    );
  }
  if (activeSlug !== appSlug) {
    return (
      <main className="mx-auto max-w-xl px-6 py-8 font-sans">
        <p className="text-slate-900">Menyiapkan konteks aplikasi…</p>
      </main>
    );
  }
  return <>{children}</>;
}
