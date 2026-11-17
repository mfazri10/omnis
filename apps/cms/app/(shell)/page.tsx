"use client";

import type { JSX } from "react";
import { useSessionStore } from "../../stores/use-session-store";

function statusLabel(status: string): string {
  if (status === "suspended") {
    return "Ditangguhkan";
  }
  return status;
}

export default function AppPickerPage(): JSX.Element {
  const apps = useSessionStore((state) => state.accessibleApps);
  const ready = useSessionStore((state) => state.ready);
  if (!ready) {
    return (
      <main className="mx-auto max-w-xl px-6 py-8 font-sans">
        <p className="text-slate-900">Menyiapkan sesi…</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Pilih aplikasi
      </h1>
      {apps.length === 0 && (
        <p className="mt-6 text-sm text-slate-600">
          Anda belum memiliki akses ke aplikasi apa pun. Hubungi Super
          Admin untuk meminta akses.
        </p>
      )}
      {apps.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {apps.map((app) => (
            <li key={app.id} className="border border-slate-200 p-4">
              <a className="block" href={`/${app.slug}`}>
                <span className="text-base font-semibold text-slate-900">
                  {app.name}
                </span>
                <span className="mt-1 block text-sm text-slate-600">
                  {app.slug} · {statusLabel(app.status)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
