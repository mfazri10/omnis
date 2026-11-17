"use client";

import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import {
  ACTIVITY_LOGS_QUERY,
  type ActivityLogsFilter,
} from "../../../../features/audit/graphql/audit.graphql";
import { useSessionStore } from "../../../../stores/use-session-store";

const PER_PAGE = 20;

/** Aksi yang dikenal backend; filter aksi memakai perbandingan persis. */
const ACTIONS = [
  "activate",
  "archive",
  "assign",
  "create",
  "deactivate",
  "delete",
  "login",
  "provision",
  "provision_retry",
  "suspend",
  "unassign",
  "unsuspend",
  "update",
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toStartOfDay(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString();
}

function toEndOfDay(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function formatEntity(
  entityType: string | null,
  entityId: string | null,
): string {
  if (entityType && entityId) {
    return `${entityType}#${entityId}`;
  }
  return entityType ?? entityId ?? "–";
}

interface FilterDraft {
  dateFrom: string;
  dateTo: string;
  appId: string;
  action: string;
  search: string;
}

const EMPTY_FILTER: FilterDraft = {
  dateFrom: "",
  dateTo: "",
  appId: "",
  action: "",
  search: "",
};

function isFiltered(draft: FilterDraft): boolean {
  return (
    draft.dateFrom !== "" ||
    draft.dateTo !== "" ||
    draft.appId !== "" ||
    draft.action !== "" ||
    draft.search.trim() !== ""
  );
}

function toFilterInput(draft: FilterDraft): ActivityLogsFilter | null {
  const filter: ActivityLogsFilter = {};
  if (draft.dateFrom !== "") {
    filter.dateFrom = toStartOfDay(draft.dateFrom);
  }
  if (draft.dateTo !== "") {
    filter.dateTo = toEndOfDay(draft.dateTo);
  }
  if (draft.appId !== "") {
    filter.appId = draft.appId;
  }
  if (draft.action !== "") {
    filter.action = draft.action;
  }
  if (draft.search.trim() !== "") {
    filter.search = draft.search.trim();
  }
  return Object.keys(filter).length > 0 ? filter : null;
}

const CONTROL_CLASS =
  "min-h-[44px] border border-slate-300 px-3 py-2 text-sm text-slate-900";
const LABEL_CLASS = "text-xs font-semibold text-slate-600";

export default function AuditPage(): JSX.Element {
  const ready = useSessionStore((state) => state.ready);
  const admin = useSessionStore((state) => state.admin);
  const permissions = useSessionStore((state) => state.permissions);
  const accessibleApps = useSessionStore((state) => state.accessibleApps);

  const canView =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.audit.view");

  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTER);
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTER);
  const [page, setPage] = useState(1);

  const { data, loading, error } = useQuery(ACTIVITY_LOGS_QUERY, {
    variables: {
      page,
      perPage: PER_PAGE,
      filter: toFilterInput(applied),
    },
    skip: !canView,
  });

  function handleApply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setApplied(draft);
  }

  function handleReset(): void {
    setDraft(EMPTY_FILTER);
    setApplied(EMPTY_FILTER);
    setPage(1);
  }

  function set<K extends keyof FilterDraft>(key: K, value: string): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const total = data?.activityLogs.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Audit Log</h1>
      {!ready && <p className="mt-6 text-slate-900">Memuat…</p>}
      {ready && !canView && (
        <p className="mt-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat Audit Log.
        </p>
      )}
      {ready && canView && (
        <>
          <form
            className="mt-6 flex flex-wrap items-end gap-3"
            onSubmit={handleApply}
          >
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Dari tanggal</span>
              <input
                type="date"
                value={draft.dateFrom}
                onChange={(e) => set("dateFrom", e.target.value)}
                className={CONTROL_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Sampai tanggal</span>
              <input
                type="date"
                value={draft.dateTo}
                onChange={(e) => set("dateTo", e.target.value)}
                className={CONTROL_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Aplikasi</span>
              <select
                value={draft.appId}
                onChange={(e) => set("appId", e.target.value)}
                className={CONTROL_CLASS}
              >
                <option value="">Semua aplikasi</option>
                {accessibleApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Aksi</span>
              <select
                value={draft.action}
                onChange={(e) => set("action", e.target.value)}
                className={CONTROL_CLASS}
              >
                <option value="">Semua aksi</option>
                {ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Ringkasan</span>
              <input
                type="search"
                placeholder="Cari ringkasan…"
                value={draft.search}
                onChange={(e) => set("search", e.target.value)}
                className={CONTROL_CLASS}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Terapkan filter
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="min-h-[44px] border border-slate-300 px-4 py-2 text-sm text-slate-900"
              >
                Atur ulang
              </button>
            </div>
          </form>
          {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
          {error && (
            <p className="mt-6 text-sm text-red-700">
              {graphQLErrorMessage(error, "Gagal memuat log audit.")}
            </p>
          )}
          {data && total === 0 && !isFiltered(applied) && (
            <p className="mt-6 text-sm text-slate-600">Belum ada log audit.</p>
          )}
          {data && total === 0 && isFiltered(applied) && (
            <p className="mt-6 text-sm text-slate-600">
              Tidak ada log audit yang cocok dengan filter.
            </p>
          )}
          {data && total > 0 && (
            <>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="py-2 pr-4 font-semibold">Waktu</th>
                      <th className="py-2 pr-4 font-semibold">Aktor</th>
                      <th className="py-2 pr-4 font-semibold">Aplikasi</th>
                      <th className="py-2 pr-4 font-semibold">Aksi</th>
                      <th className="py-2 pr-4 font-semibold">Entitas</th>
                      <th className="py-2 pr-4 font-semibold">Ringkasan</th>
                      <th className="py-2 font-semibold">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activityLogs.items.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-slate-100"
                      >
                        <td className="whitespace-nowrap py-2 pr-4 text-slate-900">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="py-2 pr-4 text-slate-900">
                          {log.adminName ?? `Admin #${log.adminId}`}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">
                          {log.appId === null
                            ? "Global"
                            : (log.appName ?? log.appSlug ?? "–")}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">
                          {log.action}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4 text-slate-600">
                          {formatEntity(log.entityType, log.entityId)}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">
                          {log.summary}
                        </td>
                        <td className="whitespace-nowrap py-2 text-slate-600">
                          {log.ipAddress ?? "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[44px] underline disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <span className="text-slate-600">
                  {`${from}–${to} dari ${total}`}
                </span>
                <button
                  type="button"
                  disabled={page * PER_PAGE >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="min-h-[44px] underline disabled:opacity-50"
                >
                  Berikutnya
                </button>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
