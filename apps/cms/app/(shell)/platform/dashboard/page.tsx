"use client";

import { useQuery } from "@apollo/client/react";
import type { JSX } from "react";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import { PLATFORM_DASHBOARD_QUERY } from "../../../../features/dashboard/graphql/dashboard.graphql";
import type { PlatformAppCardData } from "../../../../features/dashboard/graphql/dashboard.graphql";
import { useSessionStore } from "../../../../stores/use-session-store";

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

/** Label + warna badge status; badge ada agar kesehatan terbaca sekilas. */
function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "active":
      return {
        label: "Aktif",
        className: "bg-emerald-100 text-emerald-900",
      };
    case "suspended":
      return {
        label: "Ditangguhkan",
        className: "bg-amber-100 text-amber-900",
      };
    case "archived":
      return {
        label: "Diarsipkan",
        className: "bg-slate-200 text-slate-700",
      };
    case "provisioning":
      return {
        label: "Disiapkan",
        className: "bg-sky-100 text-sky-900",
      };
    case "failed":
      return {
        label: "Gagal",
        className: "bg-red-100 text-red-900",
      };
    default:
      return { label: status, className: "bg-slate-200 text-slate-700" };
  }
}

function AppCard({ app }: { app: PlatformAppCardData }): JSX.Element {
  const badge = statusBadge(app.status);
  return (
    <article className="border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{app.name}</h3>
        <span
          className={`shrink-0 px-2 py-1 text-xs font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{app.slug}</p>
      <dl className="mt-3 flex gap-6 text-sm">
        <div>
          <dt className="text-xs text-slate-600">User</dt>
          <dd className="text-lg font-semibold text-slate-900">
            {formatCount(app.userCount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Aktivitas 7 hari</dt>
          <dd className="text-lg font-semibold text-slate-900">
            {formatCount(app.activityCount7d)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default function PlatformDashboardPage(): JSX.Element {
  const ready = useSessionStore((state) => state.ready);
  const admin = useSessionStore((state) => state.admin);
  const permissions = useSessionStore((state) => state.permissions);

  const canView =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.apps.view");

  const { data, loading, error, refetch } = useQuery(
    PLATFORM_DASHBOARD_QUERY,
    { skip: !canView },
  );

  const dashboard = data?.platformDashboard ?? null;
  const queue = dashboard?.notificationQueue ?? null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Dasbor Platform
      </h1>
      {!ready && <p className="mt-6 text-slate-900">Memuat…</p>}
      {ready && !canView && (
        <p className="mt-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat dasbor platform.
        </p>
      )}
      {ready && canView && loading && (
        <p className="mt-6 text-slate-900">Memuat dasbor…</p>
      )}
      {ready && canView && error && (
        <div className="mt-6">
          <p className="text-sm text-red-700">
            {graphQLErrorMessage(error, "Gagal memuat dasbor platform.")}
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
      {ready && canView && dashboard && (
        <>
          <section aria-labelledby="antrean-notifikasi" className="mt-6">
            <h2
              id="antrean-notifikasi"
              className="text-sm font-semibold text-slate-900"
            >
              Antrean notifikasi
            </h2>
            {queue && (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="border border-slate-200 p-4">
                  <dt className="text-xs text-slate-600">Terjadwal</dt>
                  <dd className="text-2xl font-semibold text-slate-900">
                    {formatCount(queue.scheduled)}
                  </dd>
                </div>
                <div className="border border-slate-200 p-4">
                  <dt className="text-xs text-slate-600">Mengirim</dt>
                  <dd className="text-2xl font-semibold text-slate-900">
                    {formatCount(queue.sending)}
                  </dd>
                </div>
                <div className="border border-slate-200 p-4">
                  <dt className="text-xs text-slate-600">Gagal</dt>
                  <dd className="text-2xl font-semibold text-slate-900">
                    {formatCount(queue.failed)}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <section aria-labelledby="daftar-aplikasi" className="mt-8">
            <h2
              id="daftar-aplikasi"
              className="text-sm font-semibold text-slate-900"
            >
              Aplikasi
            </h2>
            {dashboard.apps.length === 0 && (
              <p className="mt-3 text-sm text-slate-600">
                Belum ada aplikasi terdaftar.
              </p>
            )}
            {dashboard.apps.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.apps.map((app) => (
                  <AppCard key={app.id} app={app} />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="aktivitas-terbaru" className="mt-8">
            <h2
              id="aktivitas-terbaru"
              className="text-sm font-semibold text-slate-900"
            >
              Aktivitas terbaru
            </h2>
            {dashboard.recentActivity.length === 0 && (
              <p className="mt-3 text-sm text-slate-600">
                Belum ada aktivitas tercatat.
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
                      {log.appName ?? "Global"}
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
