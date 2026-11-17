"use client";

import { use } from "react";
import type { JSX } from "react";
import { useSessionStore } from "../../../stores/use-session-store";

// TODO(F07): ganti placeholder ini dengan dasbor aplikasi penuh
// (statistik modul + aktivitas terakhir).
export default function AppDashboardPage({
  params,
}: {
  params: Promise<{ appSlug: string }>;
}): JSX.Element {
  const { appSlug } = use(params);
  const apps = useSessionStore((state) => state.accessibleApps);
  const permissions = useSessionStore((state) => state.permissions);
  const permissionsContext = useSessionStore(
    (state) => state.permissionsContext,
  );
  const app = apps.find((item) => item.slug === appSlug) ?? null;
  if (app === null) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
        <p className="text-slate-900">Memuat aplikasi…</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Dasbor aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{app.name}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {app.slug} · {app.status}
      </p>
      <div className="mt-6 border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Konteks aktif
        </h2>
        <p className="mt-2 text-sm text-slate-900">
          {permissions.length} permission efektif dalam konteks{" "}
          {permissionsContext}.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Statistik modul dan aktivitas terakhir menyusul di F07.
        </p>
      </div>
    </main>
  );
}
