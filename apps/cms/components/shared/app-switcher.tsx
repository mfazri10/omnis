"use client";

import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useSessionStore } from "../../stores/use-session-store";

export function AppSwitcher(): JSX.Element {
  const router = useRouter();
  const apps = useSessionStore((state) => state.accessibleApps);
  const activeSlug = useSessionStore((state) => state.activeSlug);
  const setActiveSlug = useSessionStore((state) => state.setActiveSlug);
  if (apps.length === 0) {
    return <p className="text-sm text-slate-600">Tanpa aplikasi</p>;
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">Aplikasi</span>
      <select
        aria-label="Pilih aplikasi"
        value={activeSlug ?? ""}
        onChange={(event) => {
          const slug = event.target.value;
          if (slug === "") {
            setActiveSlug(null);
            router.push("/");
            return;
          }
          setActiveSlug(slug);
          router.push(`/${slug}`);
        }}
        className="min-h-[44px] border border-slate-300 px-2 py-2 text-sm text-slate-900"
      >
        <option value="">Semua aplikasi</option>
        {apps.map((app) => (
          <option key={app.id} value={app.slug}>
            {app.name}
          </option>
        ))}
      </select>
    </label>
  );
}
