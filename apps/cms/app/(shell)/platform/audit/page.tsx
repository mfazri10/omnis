"use client";

import { PageHeader } from "@/components/shared/page-header";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { ErrorState, LoadingState } from "@/components/shared/page-state";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";

import { useQuery } from "@apollo/client/react";
import { useEffect, useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import {
  ACTIVITY_LOGS_QUERY,
  type ActivityLogData,
  type ActivityLogsFilter,
} from "../../../../features/audit/graphql/audit.graphql";
import { ExportButton } from "../../../../features/exports/components/export-button";
import { EXPORT_ACTIVITY_LOGS_MUTATION } from "../../../../features/exports/graphql/exports.graphql";
import { useSessionStore } from "../../../../stores/use-session-store";

const PER_PAGE = 20;
const columns: ColumnDef<ActivityLogData>[] = [
  { id: "time", header: "Waktu", cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { id: "actor", header: "Aktor", cell: ({ row: { original: log } }) => log.adminName ?? `Admin #${log.adminId}` },
  { id: "app", header: "Aplikasi", cell: ({ row: { original: log } }) =>
    log.appId === null ? "Global" : log.appName ?? log.appSlug ?? "–" },
  { accessorKey: "action", header: "Aksi" },
  { id: "entity", header: "Entitas", cell: ({ row: { original: log } }) => formatEntity(log.entityType, log.entityId) },
  { id: "summary", header: "Ringkasan", cell: ({ row }) =>
    <p className="min-w-40 max-w-80 whitespace-normal wrap-anywhere">{row.original.summary}</p> },
  { id: "ip", header: "IP", cell: ({ row }) => row.original.ipAddress ?? "–" },
];

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
  "min-h-11 max-w-full rounded-md border border-input bg-card px-3 py-2 text-sm";
const LABEL_CLASS = "text-sm font-medium text-muted-foreground";

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

  const { data, loading, error, refetch } = useQuery(ACTIVITY_LOGS_QUERY, {
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
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  useEffect(() => {
    if (data && !loading && page > lastPage) setPage(lastPage);
  }, [data, lastPage, loading, page]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Audit Log" />
      {!ready && <LoadingState />}
      {ready && !canView && (
        <p className="mt-6 text-sm text-muted-foreground">
          Anda tidak memiliki izin untuk melihat Audit Log.
        </p>
      )}
      {ready && canView && (
        <>
          <TableToolbar onSubmit={handleApply}>
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
              <Button type="submit" className="min-h-11">
                Terapkan filter
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={handleReset}>
                Atur ulang
              </Button>
            </div>
            <ExportButton
              requestMutation={EXPORT_ACTIVITY_LOGS_MUTATION}
              filter={toFilterInput(applied)}
              labelSumber="log audit"
            />
          </TableToolbar>
          {(loading || page > lastPage) && <LoadingState />}
          {error && <ErrorState onRetry={() => void refetch()}>{graphQLErrorMessage(error, "Gagal memuat log audit.")}</ErrorState>}
          {data && !loading && !error && page <= lastPage && <DataTable
            rows={data.activityLogs.items} columns={columns} getRowId={(log) => log.id}
            label="Daftar log audit"
            emptyMessage={isFiltered(applied) ? "Tidak ada log audit yang cocok dengan filter." : "Belum ada log audit."}
            pagination={{ pageIndex: page - 1, pageSize: PER_PAGE, totalRows: total, onPageChange: (index) => setPage(index + 1) }}
          />}
        </>
      )}
    </main>
  );
}
