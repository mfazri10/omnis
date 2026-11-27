"use client";

import { PageHeader } from "@/components/shared/page-header";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { useBoundedPage } from "@/hooks/use-bounded-page";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared/page-state";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

import { useQuery } from "@apollo/client/react";
import { use, useState } from "react";
import type { FormEvent, JSX } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import {
  CBT_PACKAGES_QUERY,
  CBT_PACKAGE_STATS_QUERY,
  CBT_RESULTS_QUERY,
} from "../../../../../features/cbt/graphql/cbt.graphql";
import type {
  CbtResultData,
  CbtResultsFilter,
} from "../../../../../features/cbt/graphql/cbt.graphql";
import { ExportButton } from "../../../../../features/exports/components/export-button";
import { EXPORT_CBT_RESULTS_MUTATION } from "../../../../../features/exports/graphql/exports.graphql";
import { useSessionStore } from "../../../../../stores/use-session-store";

const PER_PAGE = 20;
const CONTROL_CLASS =
  "min-h-11 max-w-full rounded-md border border-input bg-card px-3 py-2 text-sm";
const LABEL_CLASS = "text-sm font-medium text-muted-foreground";

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAvg(value: number | null): string {
  if (value === null) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface FilterDraft {
  packageId: string;
  passed: string;
}

const EMPTY_FILTER: FilterDraft = { packageId: "", passed: "" };

function toFilterInput(draft: FilterDraft): CbtResultsFilter | null {
  const filter: CbtResultsFilter = {};
  if (draft.packageId !== "") filter.packageId = draft.packageId;
  if (draft.passed === "yes") filter.passed = true;
  if (draft.passed === "no") filter.passed = false;
  return Object.keys(filter).length > 0 ? filter : null;
}

export default function CbtHasilPage({
  params,
}: {
  params: Promise<{ appSlug: string }>;
}): JSX.Element {
  const { appSlug } = use(params);
  const ready = useSessionStore((state) => state.ready);
  const admin = useSessionStore((state) => state.admin);
  const activeSlug = useSessionStore((state) => state.activeSlug);
  const permissions = useSessionStore((state) => state.permissions);

  const canView =
    admin?.isSuperAdmin === true || permissions.includes("cbt.results.view");

  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTER);
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  const [statsPackageId, setStatsPackageId] = useState("");

  const contextReady = ready && activeSlug === appSlug;
  const { data, loading, error, refetch } = useQuery(CBT_RESULTS_QUERY, {
    variables: { page, perPage: PER_PAGE, filter: toFilterInput(applied) },
    skip: !canView || !contextReady,
  });
  const packages = useQuery(CBT_PACKAGES_QUERY, {
    variables: { perPage: 100 },
    skip: !canView || !contextReady,
  });
  const stats = useQuery(CBT_PACKAGE_STATS_QUERY, {
    variables: { packageId: statsPackageId },
    skip: !canView || !contextReady || statsPackageId === "",
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

  const total = data?.cbtResults.total ?? 0;
  const pageValid = useBoundedPage(page, setPage, PER_PAGE, loading ? undefined : data?.cbtResults.total);
  const packageItems = packages.data?.cbtPackages.items ?? [];
  const statsData = stats.data?.cbtPackageStats;

  const columns: ColumnDef<CbtResultData>[] = [
    {
      id: "participant",
      header: "Peserta",
      cell: ({ row: { original: r } }) => (
        <span className="font-medium">{r.participantName}</span>
      ),
    },
    {
      id: "package",
      header: "Paket",
      cell: ({ row: { original: r } }) => (
        <span className="text-muted-foreground">{r.packageTitle}</span>
      ),
    },
    {
      id: "twk",
      header: "TWK",
      cell: ({ row: { original: r } }) => (
        <span className="tabular-nums text-muted-foreground">{r.twkScore}</span>
      ),
    },
    {
      id: "tiu",
      header: "TIU",
      cell: ({ row: { original: r } }) => (
        <span className="tabular-nums text-muted-foreground">{r.tiuScore}</span>
      ),
    },
    {
      id: "tkp",
      header: "TKP",
      cell: ({ row: { original: r } }) => (
        <span className="tabular-nums text-muted-foreground">{r.tkpScore}</span>
      ),
    },
    {
      id: "total",
      header: "Total",
      cell: ({ row: { original: r } }) => (
        <span className="font-semibold tabular-nums">{r.totalScore}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row: { original: r } }) => (
        <StatusBadge
          label={r.passed ? "Lulus" : "Tidak lulus"}
          tone={r.passed ? "success" : "danger"}
        />
      ),
    },
    {
      id: "finishedAt",
      header: "Selesai",
      cell: ({ row: { original: r } }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(r.finishedAt)}
        </span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Hasil & analitik" description={appSlug} />
      {!ready && <LoadingState />}
      {ready && !canView && (
        <EmptyState>Anda tidak memiliki izin untuk melihat hasil ujian aplikasi ini.</EmptyState>
      )}
      {ready && canView && (
        <>
          {!contextReady && <LoadingState>Menyiapkan konteks…</LoadingState>}
          {contextReady && (
            <>
              <section className="mt-6 rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">
                  Analitik per paket
                </h2>
                <label className="mt-2 flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Pilih paket</span>
                  <select
                    value={statsPackageId}
                    onChange={(e) => setStatsPackageId(e.target.value)}
                    className={CONTROL_CLASS}
                  >
                    <option value="">Pilih paket…</option>
                    {packageItems.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                {stats.loading && (
                  <LoadingState>Menghitung statistik…</LoadingState>
                )}
                {stats.error && (
                  <ErrorState>
                    {graphQLErrorMessage(stats.error, "Gagal memuat statistik.")}
                  </ErrorState>
                )}
                {statsData && (
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-border p-3">
                      <p className={LABEL_CLASS}>Sesi selesai</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">
                        {statsData.completed}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className={LABEL_CLASS}>Lulus</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">
                        {statsData.passedCount}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          ({formatAvg(statsData.passRate)}%)
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className={LABEL_CLASS}>Rata-rata total</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">
                        {formatAvg(statsData.avgTotal)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {`tertinggi ${statsData.maxTotal ?? "-"} / terendah ${statsData.minTotal ?? "-"}`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className={LABEL_CLASS}>Rata-rata per kategori</p>
                      <p className="mt-1 text-sm">
                        {`TWK ${formatAvg(statsData.avgTwk)}`}
                      </p>
                      <p className="text-sm">
                        {`TIU ${formatAvg(statsData.avgTiu)}`}
                      </p>
                      <p className="text-sm">
                        {`TKP ${formatAvg(statsData.avgTkp)}`}
                      </p>
                    </div>
                  </div>
                )}
                {statsData && statsData.completed === 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Belum ada sesi selesai pada paket ini.
                  </p>
                )}
              </section>

              <TableToolbar onSubmit={handleApply}>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Paket</span>
                  <select
                    value={draft.packageId}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, packageId: e.target.value }))
                    }
                    className={CONTROL_CLASS}
                  >
                    <option value="">Semua paket</option>
                    {packageItems.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Kelulusan</span>
                  <select
                    value={draft.passed}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, passed: e.target.value }))
                    }
                    className={CONTROL_CLASS}
                  >
                    <option value="">Semua</option>
                    <option value="yes">Lulus</option>
                    <option value="no">Tidak lulus</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button type="submit" className="min-h-11">Terapkan filter</Button>
                  <Button type="button" variant="outline" className="min-h-11" onClick={handleReset}>
                    Atur ulang
                  </Button>
                </div>
                <ExportButton
                  requestMutation={EXPORT_CBT_RESULTS_MUTATION}
                  filter={toFilterInput(applied)}
                  labelSumber="hasil CBT"
                />
              </TableToolbar>

              {loading && <LoadingState />}
              {error && (
                <ErrorState onRetry={() => void refetch()}>
                  {graphQLErrorMessage(error, "Gagal memuat hasil ujian.")}
                </ErrorState>
              )}
              {data && total === 0 && (
                <EmptyState>
                  Belum ada hasil yang cocok. Selesaikan sesi simulasi atau ubah filter.
                </EmptyState>
              )}
              {data && pageValid && (
                <div className="mt-6">
                  <DataTable
                    rows={data.cbtResults.items}
                    columns={columns}
                    getRowId={(r) => r.id}
                    label="Hasil ujian"
                    emptyMessage={total === 0 ? "Belum ada hasil yang cocok. Selesaikan sesi simulasi atau ubah filter." : "Tidak ada hasil pada halaman ini."}
                    pagination={{ pageIndex: page - 1, pageSize: PER_PAGE, totalRows: total, onPageChange: (index) => setPage(index + 1) }}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
