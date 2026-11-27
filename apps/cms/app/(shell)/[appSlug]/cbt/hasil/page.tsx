"use client";

import { PageHeader } from "@/components/shared/page-header";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { useBoundedPage } from "@/hooks/use-bounded-page";
import { LoadingState } from "@/components/shared/page-state";
import { Table } from "@/components/ui/table";

import { useQuery } from "@apollo/client/react";
import { use, useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import {
  CBT_PACKAGES_QUERY,
  CBT_PACKAGE_STATS_QUERY,
  CBT_RESULTS_QUERY,
} from "../../../../../features/cbt/graphql/cbt.graphql";
import type { CbtResultsFilter } from "../../../../../features/cbt/graphql/cbt.graphql";
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
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);
  const packageItems = packages.data?.cbtPackages.items ?? [];
  const statsData = stats.data?.cbtPackageStats;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Hasil & analitik" description={appSlug} />
      {!ready && <LoadingState />}
      {ready && !canView && (
        <p className="mt-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat hasil ujian aplikasi ini.
        </p>
      )}
      {ready && canView && (
        <>
          {!contextReady && (
            <p className="mt-6 text-slate-900">Menyiapkan konteks…</p>
          )}
          {contextReady && (
            <>
              <section className="mt-6 border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-900">
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
                  <p className="mt-3 text-sm text-slate-900">Menghitung statistik…</p>
                )}
                {stats.error && (
                  <p className="mt-3 text-sm text-red-700">
                    {graphQLErrorMessage(stats.error, "Gagal memuat statistik.")}
                  </p>
                )}
                {statsData && (
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="border border-slate-100 p-3">
                      <p className={LABEL_CLASS}>Sesi selesai</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {statsData.completed}
                      </p>
                    </div>
                    <div className="border border-slate-100 p-3">
                      <p className={LABEL_CLASS}>Lulus</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {statsData.passedCount}
                        <span className="ml-1 text-sm font-normal text-slate-600">
                          ({formatAvg(statsData.passRate)}%)
                        </span>
                      </p>
                    </div>
                    <div className="border border-slate-100 p-3">
                      <p className={LABEL_CLASS}>Rata-rata total</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {formatAvg(statsData.avgTotal)}
                      </p>
                      <p className="text-xs text-slate-600">
                        {`tertinggi ${statsData.maxTotal ?? "-"} / terendah ${statsData.minTotal ?? "-"}`}
                      </p>
                    </div>
                    <div className="border border-slate-100 p-3">
                      <p className={LABEL_CLASS}>Rata-rata per kategori</p>
                      <p className="mt-1 text-sm text-slate-900">
                        {`TWK ${formatAvg(statsData.avgTwk)}`}
                      </p>
                      <p className="text-sm text-slate-900">
                        {`TIU ${formatAvg(statsData.avgTiu)}`}
                      </p>
                      <p className="text-sm text-slate-900">
                        {`TKP ${formatAvg(statsData.avgTkp)}`}
                      </p>
                    </div>
                  </div>
                )}
                {statsData && statsData.completed === 0 && (
                  <p className="mt-3 text-sm text-slate-600">
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
                <ExportButton
                  requestMutation={EXPORT_CBT_RESULTS_MUTATION}
                  filter={toFilterInput(applied)}
                  labelSumber="hasil CBT"
                />
              </TableToolbar>

              {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
              {error && (
                <div className="mt-6">
                  <p className="text-sm text-red-700">
                    {graphQLErrorMessage(error, "Gagal memuat hasil ujian.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="mt-2 min-h-[44px] underline"
                  >
                    Muat ulang
                  </button>
                </div>
              )}
              {data && total === 0 && (
                <p className="mt-6 text-sm text-slate-600">
                  Belum ada hasil yang cocok. Selesaikan sesi simulasi atau
                  ubah filter.
                </p>
              )}
              {data && total > 0 && pageValid && (
                <>
                  <div className="mt-6 overflow-x-auto">
                    <Table scrollLabel="Hasil ujian" className="min-w-max bg-card text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="py-2 pr-4 font-semibold">Peserta</th>
                          <th className="py-2 pr-4 font-semibold">Paket</th>
                          <th className="py-2 pr-4 font-semibold">TWK</th>
                          <th className="py-2 pr-4 font-semibold">TIU</th>
                          <th className="py-2 pr-4 font-semibold">TKP</th>
                          <th className="py-2 pr-4 font-semibold">Total</th>
                          <th className="py-2 pr-4 font-semibold">Status</th>
                          <th className="py-2 font-semibold">Selesai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cbtResults.items.map((r) => (
                          <tr key={r.id} className="border-b border-slate-100">
                            <td className="py-2 pr-4 text-slate-900">
                              {r.participantName}
                            </td>
                            <td className="py-2 pr-4 text-slate-600">
                              {r.packageTitle}
                            </td>
                            <td className="py-2 pr-4 text-slate-600">
                              {r.twkScore}
                            </td>
                            <td className="py-2 pr-4 text-slate-600">
                              {r.tiuScore}
                            </td>
                            <td className="py-2 pr-4 text-slate-600">
                              {r.tkpScore}
                            </td>
                            <td className="py-2 pr-4 font-semibold text-slate-900">
                              {r.totalScore}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={
                                  r.passed
                                    ? "bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
                                    : "bg-red-100 px-2 py-1 text-xs font-semibold text-red-800"
                                }
                              >
                                {r.passed ? "Lulus" : "Tidak lulus"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap py-2 text-slate-600">
                              {formatDateTime(r.finishedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
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
        </>
      )}
    </main>
  );
}
