"use client";

import type { JSX } from "react";
import { useSessionStore } from "@/stores/use-session-store";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, LoadingState } from "@/components/shared/page-state";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

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
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <LoadingState>Menyiapkan sesi…</LoadingState>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader title="Pilih aplikasi" description="Buka ruang kerja aplikasi yang dapat Anda kelola." />
      {apps.length === 0 && (
        <EmptyState>
          Anda belum memiliki akses ke aplikasi apa pun. Hubungi Super
          Admin untuk meminta akses.
        </EmptyState>
      )}
      {apps.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {apps.map((app) => (
            <li key={app.id} className="min-w-0">
              <Card className="py-0">
                <CardContent className="p-0">
                  <Link className="block rounded-lg p-4 hover:bg-muted" href={`/${app.slug}`}>
                    <span className="block font-semibold wrap-anywhere">{app.name}</span>
                    <span className="mt-1 block text-sm text-muted-foreground wrap-anywhere">
                      {app.slug} · {statusLabel(app.status)}
                    </span>
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
