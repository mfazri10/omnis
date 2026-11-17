"use client";

import { useQuery } from "@apollo/client/react";
import { use } from "react";
import type { JSX } from "react";
import { APP_DASHBOARD_QUERY } from "../../../features/dashboard/graphql/dashboard.graphql";
import { graphQLErrorMessage } from "../../../features/rbac/graphql/errors";
import { useSessionStore } from "../../../stores/use-session-store";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCount(value: number): string {
  return value.toLocaleString("id-ID");
}

export default function AppDashboardPage({
  params,
}: {
  params: Promise<{ appSlug: string }>;
}): JSX.Element {
  const { appSlug } = use(params);
  const apps = useSessionStore((state) => state.accessibleApps);
  const app = apps.find((item) => item.slug === appSlug) ?? null;

  // Header X-App-Slug diisi dari activeSlug (layout [appSlug]); tunda
  // query sampai konteks store mengenal slug agar tak memakai slug basi.
  const { data, loading, error, refetch } = useQuery(APP_DASHBOARD_QUERY, {
    skip: app === null,
  });

  if (app === null) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
        <p className="text-slate-900">Memuat aplikasi…</p>
      </main>
    );
  }

  const dashboard = data?.appDashboard ?? null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Dasbor aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {dashboard?.app.name ?? app.name}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {app.slug} · {dashboard?.app.status ?? app.status}
      </p>

      {loading && <p className="mt-6 text-slate-900">Memuat dasbor…</p>}
      {error && (
        <div className="mt-6">
          <p className="text-sm text-red-700">
            {graphQLErrorMessage(error, "Gagal memuat dasbor aplikasi.")}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Muat ulang
          </button>
        </div>
      )}
      {dashboard && (
        <>
          <section aria-labelledby="statistik-modul" className="mt-6">
            <h2
              id="statistik-modul"
              className="text-sm font-semibold text-slate-900"
            >
              Statistik modul
            </h2>
            {dashboard.sections.length === 0 && (
              <p className="mt-3 text-sm text-slate-600">
                Belum ada statistik modul.
              </p>
            )}
            {dashboard.sections.length > 0 && (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.sections.map((section) => (
                  <div
                    key={section.key}
                    className="border border-slate-200 p-4"
                  >
                    <dt className="text-xs text-slate-600">{section.label}</dt>
                    <dd className="text-2xl font-semibold text-slate-900">
                      {formatCount(section.value)}
                    </dd>
                    {section.hint && (
                      <dd className="mt-1 text-xs text-slate-600">
                        {section.hint}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section aria-labelledby="kampanye" className="mt-8">
            <h2
              id="kampanye"
              className="text-sm font-semibold text-slate-900"
            >
              Kampanye notifikasi
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="border border-slate-200 p-4">
                <dt className="text-xs text-slate-600">Draf</dt>
                <dd className="text-2xl font-semibold text-slate-900">
                  {formatCount(dashboard.campaigns.draft)}
                </dd>
              </div>
              <div className="border border-slate-200 p-4">
                <dt className="text-xs text-slate-600">Terjadwal</dt>
                <dd className="text-2xl font-semibold text-slate-900">
                  {formatCount(dashboard.campaigns.scheduled)}
                </dd>
              </div>
              <div className="border border-slate-200 p-4">
                <dt className="text-xs text-slate-600">Terkirim</dt>
                <dd className="text-2xl font-semibold text-slate-900">
                  {formatCount(dashboard.campaigns.sent)}
                </dd>
              </div>
              <div className="border border-slate-200 p-4">
                <dt className="text-xs text-slate-600">Gagal</dt>
                <dd className="text-2xl font-semibold text-slate-900">
                  {formatCount(dashboard.campaigns.failed)}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="aktivitas-terbaru" className="mt-8">
            <h2
              id="aktivitas-terbaru"
              className="text-sm font-semibold text-slate-900"
            >
              Aktivitas terakhir
            </h2>
            {dashboard.recentActivity.length === 0 && (
              <p className="mt-3 text-sm text-slate-600">
                Belum ada aktivitas tercatat untuk aplikasi ini.
              </p>
            )}
            {dashboard.recentActivity.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-200">
                {dashboard.recentActivity.map((log) => (
                  <li key={log.id} className="py-3 text-sm">
                    <p className="text-slate-900">{log.summary}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {log.adminName ?? `Admin #${log.adminId}`}
                      {" · "}
                      {formatDateTime(log.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
