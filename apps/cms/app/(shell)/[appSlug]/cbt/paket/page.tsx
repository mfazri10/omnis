"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { useBoundedPage } from "@/hooks/use-bounded-page";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared/page-state";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

import { useMutation, useQuery } from "@apollo/client/react";
import { use, useState } from "react";
import type { FormEvent, JSX } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import {
  CBT_PACKAGES_QUERY,
  CBT_PACKAGE_QUERY,
  CBT_QUESTIONS_QUERY,
  CREATE_CBT_PACKAGE_MUTATION,
  SET_CBT_PACKAGE_QUESTIONS_MUTATION,
  UPDATE_CBT_PACKAGE_MUTATION,
} from "../../../../../features/cbt/graphql/cbt.graphql";
import type {
  CbtCategory,
  CbtPackageData,
  CbtPackagesFilter,
  CreateCbtPackageInput,
} from "../../../../../features/cbt/graphql/cbt.graphql";
import { useSessionStore } from "../../../../../stores/use-session-store";

const PER_PAGE = 20;
const CONTROL_CLASS =
  "min-h-11 max-w-full rounded-md border border-input bg-card px-3 py-2 text-sm";
const LABEL_CLASS = "text-sm font-medium text-muted-foreground";

type StatusMessage = { kind: "sukses" | "gagal"; text: string };

interface FilterDraft {
  search: string;
  status: string;
}

const EMPTY_FILTER: FilterDraft = { search: "", status: "" };

function toFilterInput(draft: FilterDraft): CbtPackagesFilter | null {
  const filter: CbtPackagesFilter = {};
  if (draft.search.trim() !== "") filter.search = draft.search.trim();
  if (draft.status === "active") filter.isActive = true;
  if (draft.status === "inactive") filter.isActive = false;
  return Object.keys(filter).length > 0 ? filter : null;
}

interface PackageFormProps {
  initial: CbtPackageData | null;
  onDone: (status: StatusMessage) => void;
  onCancel: () => void;
}

function PackageForm({ initial, onDone, onCancel }: PackageFormProps): JSX.Element {
  const [createPackage, { loading: creating }] = useMutation(
    CREATE_CBT_PACKAGE_MUTATION,
  );
  const [updatePackage, { loading: updating }] = useMutation(
    UPDATE_CBT_PACKAGE_MUTATION,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [duration, setDuration] = useState(
    String(initial?.durationMinutes ?? 100),
  );
  const [pgTwk, setPgTwk] = useState(String(initial?.passingGrade.twk ?? 65));
  const [pgTiu, setPgTiu] = useState(String(initial?.passingGrade.tiu ?? 80));
  const [pgTkp, setPgTkp] = useState(String(initial?.passingGrade.tkp ?? 166));
  const saving = creating || updating;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const input: CreateCbtPackageInput = {
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
      durationMinutes: Number(duration),
      passingGrade: {
        twk: Number(pgTwk),
        tiu: Number(pgTiu),
        tkp: Number(pgTkp),
      },
    };
    try {
      if (initial === null) {
        await createPackage({
          variables: { input },
          refetchQueries: [CBT_PACKAGES_QUERY],
          awaitRefetchQueries: true,
        });
        onDone({ kind: "sukses", text: "Paket dibuat. Susun komposisi soalnya." });
      } else {
        await updatePackage({
          variables: { id: initial.id, input },
          refetchQueries: [CBT_PACKAGES_QUERY],
          awaitRefetchQueries: true,
        });
        onDone({ kind: "sukses", text: "Perubahan paket tersimpan." });
      }
    } catch (err: unknown) {
      onDone({ kind: "gagal", text: graphQLErrorMessage(err, "Gagal menyimpan paket.") });
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">
        {initial === null ? "Tambah paket" : `Ubah paket: ${initial.title}`}
      </h2>
      <form
        className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Judul (wajib)</span>
          <input
            type="text"
            required
            maxLength={255}
            value={title}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            className={CONTROL_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Durasi (menit, 1..600)</span>
          <input
            type="number"
            min={1}
            max={600}
            required
            value={duration}
            disabled={saving}
            onChange={(e) => setDuration(e.target.value)}
            className={CONTROL_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className={LABEL_CLASS}>Deskripsi (opsional)</span>
          <textarea
            rows={2}
            value={description}
            disabled={saving}
            onChange={(e) => setDescription(e.target.value)}
            className={CONTROL_CLASS}
          />
        </label>
        <fieldset className="md:col-span-2">
          <legend className={LABEL_CLASS}>
            Passing grade per kategori (bilangan bulat &ge; 0)
          </legend>
          <div className="mt-1 flex flex-wrap gap-3">
            <label className="flex items-center gap-1 text-sm">
              TWK
              <input
                type="number"
                min={0}
                required
                value={pgTwk}
                disabled={saving}
                onChange={(e) => setPgTwk(e.target.value)}
                className="min-h-11 w-24 rounded-md border border-input bg-card px-2 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-1 text-sm">
              TIU
              <input
                type="number"
                min={0}
                required
                value={pgTiu}
                disabled={saving}
                onChange={(e) => setPgTiu(e.target.value)}
                className="min-h-11 w-24 rounded-md border border-input bg-card px-2 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-1 text-sm">
              TKP
              <input
                type="number"
                min={0}
                required
                value={pgTkp}
                disabled={saving}
                onChange={(e) => setPgTkp(e.target.value)}
                className="min-h-11 w-24 rounded-md border border-input bg-card px-2 py-2 text-sm"
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Peserta lulus bila skor tiap kategori mencapai ambangnya.
          </p>
        </fieldset>
        <div className="flex gap-2 md:col-span-2">
          <Button
            type="submit"
            disabled={saving}
            className="min-h-11"
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={onCancel}
            variant="outline"
            className="min-h-11"
          >
            Batal
          </Button>
        </div>
      </form>
    </section>
  );
}

interface CompositionEditorProps {
  pkg: CbtPackageData;
  onDone: (status: StatusMessage) => void;
  onClose: () => void;
}

function CompositionEditor({ pkg, onDone, onClose }: CompositionEditorProps): JSX.Element {
  const [setQuestions, { loading: saving }] = useMutation(
    SET_CBT_PACKAGE_QUESTIONS_MUTATION,
  );
  const [selected, setSelected] = useState<string[] | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  const detail = useQuery(CBT_PACKAGE_QUERY, { variables: { id: pkg.id } });
  const bank = useQuery(CBT_QUESTIONS_QUERY, {
    variables: {
      perPage: 100,
      filter: {
        isActive: true,
        ...(categoryFilter !== ""
          ? { category: categoryFilter as CbtCategory }
          : {}),
      },
    },
  });

  const current =
    selected ??
    (detail.data?.cbtPackage.questions.map((q) => q.id) ?? []);

  function toggle(id: string): void {
    setSelected(
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function handleSave(): Promise<void> {
    try {
      await setQuestions({
        variables: { id: pkg.id, questionIds: current },
        refetchQueries: [CBT_PACKAGES_QUERY],
        awaitRefetchQueries: true,
      });
      onDone({
        kind: "sukses",
        text: `Komposisi paket "${pkg.title}" disimpan (${current.length} soal).`,
      });
      onClose();
    } catch (err: unknown) {
      onDone({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal menyimpan komposisi."),
      });
    }
  }

  const bankItems = bank.data?.cbtQuestions?.items ?? [];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">
        Komposisi soal: {pkg.title}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Centang soal aktif yang masuk paket. Urutan centang menjadi urutan
        penyajian. Soal nonaktif tidak bisa dimasukkan.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Kategori
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={CONTROL_CLASS}
          >
            <option value="">Semua</option>
            <option value="TWK">TWK</option>
            <option value="TIU">TIU</option>
            <option value="TKP">TKP</option>
          </select>
        </label>
        <span className="text-sm text-muted-foreground">
          {current.length} soal dipilih
        </span>
      </div>
      {bank.loading && <LoadingState>Memuat bank soal…</LoadingState>}
      {bank.error && (
        <ErrorState>{graphQLErrorMessage(bank.error, "Gagal memuat bank soal.")}</ErrorState>
      )}
      {bank.data && bankItems.length === 0 && (
        <EmptyState>Tidak ada soal aktif pada kategori ini.</EmptyState>
      )}
      {bankItems.length > 0 && (
        <ul className="mt-3 flex max-h-80 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
          {bankItems.map((q) => (
            <li key={q.id}>
              <label className="flex min-h-11 items-start gap-2 px-1 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={current.includes(q.id)}
                  onChange={() => toggle(q.id)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="font-semibold">[{q.category}]</span>{" "}
                  <span className="line-clamp-2">{q.stem}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          disabled={saving || detail.loading}
          onClick={() => void handleSave()}
          className="min-h-11"
        >
          {saving ? "Menyimpan…" : "Simpan komposisi"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onClose}
          className="min-h-11"
        >
          Tutup
        </Button>
      </div>
    </section>
  );
}

export default function CbtPaketPage({
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
    admin?.isSuperAdmin === true || permissions.includes("cbt.packages.view");
  const canManage =
    admin?.isSuperAdmin === true ||
    permissions.includes("cbt.packages.manage");

  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTER);
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CbtPackageData | null>(null);
  const [composing, setComposing] = useState<CbtPackageData | null>(null);

  const [updatePackage, { loading: toggling }] = useMutation(
    UPDATE_CBT_PACKAGE_MUTATION,
  );

  const contextReady = ready && activeSlug === appSlug;
  const { data, loading, error, refetch } = useQuery(CBT_PACKAGES_QUERY, {
    variables: { page, perPage: PER_PAGE, filter: toFilterInput(applied) },
    skip: !canView || !contextReady,
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

  async function handleToggle(pkg: CbtPackageData): Promise<void> {
    const action = pkg.isActive ? "menonaktifkan" : "mengaktifkan";
    if (!window.confirm(`Anda yakin ingin ${action} paket "${pkg.title}"?`)) return;
    try {
      await updatePackage({
        variables: { id: pkg.id, input: { isActive: !pkg.isActive } },
        refetchQueries: [CBT_PACKAGES_QUERY],
        awaitRefetchQueries: true,
      });
      setStatus({
        kind: "sukses",
        text: `Paket "${pkg.title}" ${pkg.isActive ? "dinonaktifkan" : "diaktifkan"}.`,
      });
    } catch (err: unknown) {
      setStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal mengubah status paket."),
      });
    }
  }

  const total = data?.cbtPackages.total ?? 0;
  const pageValid = useBoundedPage(page, setPage, PER_PAGE, loading ? undefined : data?.cbtPackages.total);

  const columns: ColumnDef<CbtPackageData>[] = [
    {
      id: "title",
      header: "Judul",
      cell: ({ row: { original: pkg } }) => (
        <span className="block max-w-72 whitespace-normal font-medium wrap-anywhere">
          {pkg.title}
        </span>
      ),
    },
    {
      id: "duration",
      header: "Durasi",
      cell: ({ row: { original: pkg } }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {pkg.durationMinutes} menit
        </span>
      ),
    },
    {
      id: "passingGrade",
      header: "Passing grade",
      cell: ({ row: { original: pkg } }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {`TWK ${pkg.passingGrade.twk} / TIU ${pkg.passingGrade.tiu} / TKP ${pkg.passingGrade.tkp}`}
        </span>
      ),
    },
    {
      id: "questionCount",
      header: "Soal",
      cell: ({ row: { original: pkg } }) => (
        <span className="tabular-nums">{pkg.questionCount}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row: { original: pkg } }) => (
        <StatusBadge
          label={pkg.isActive ? "Aktif" : "Nonaktif"}
          tone={pkg.isActive ? "success" : "neutral"}
        />
      ),
    },
  ];
  if (canManage) {
    columns.push({
      id: "actions",
      header: "Aksi",
      cell: ({ row: { original: pkg } }) => (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="button"
            variant="link"
            className="min-h-11"
            onClick={() => {
              setEditing(pkg);
              setStatus(null);
              setFormOpen(true);
            }}
          >
            Ubah
          </Button>
          <Button
            type="button"
            variant="link"
            className="min-h-11"
            onClick={() => {
              setComposing(pkg);
              setStatus(null);
            }}
          >
            Komposisi
          </Button>
          <Button
            type="button"
            variant="link"
            className="min-h-11"
            disabled={toggling}
            onClick={() => void handleToggle(pkg)}
          >
            {pkg.isActive ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        </div>
      ),
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Paket ujian" description={appSlug} />
      {!ready && <LoadingState />}
      {ready && !canView && (
        <EmptyState>Anda tidak memiliki izin untuk melihat paket ujian aplikasi ini.</EmptyState>
      )}
      {ready && canView && (
        <>
          {!contextReady && <LoadingState>Menyiapkan konteks…</LoadingState>}
          {contextReady && (
            <>
              <TableToolbar onSubmit={handleApply}>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Pencarian</span>
                  <Input
                    type="search"
                    placeholder="Cari judul paket…"
                    value={draft.search}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, search: e.target.value }))
                    }
                    className="min-h-11 bg-card"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Status</span>
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className={CONTROL_CLASS}
                  >
                    <option value="">Semua status</option>
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button type="submit" className="min-h-11">Terapkan filter</Button>
                  <Button type="button" variant="outline" className="min-h-11" onClick={handleReset}>
                    Atur ulang
                  </Button>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setEditing(null);
                      setStatus(null);
                      setFormOpen(true);
                    }}
                  >
                    Tambah paket
                  </Button>
                )}
              </TableToolbar>

              {status && (
                <p
                  className={
                    status.kind === "sukses"
                      ? "mt-4 text-sm text-emerald-700"
                      : "mt-4 text-sm text-destructive"
                  }
                >
                  {status.text}
                </p>
              )}

              {formOpen && canManage && (
                <div className="mt-6">
                  <PackageForm
                    key={editing ? editing.id : "baru"}
                    initial={editing}
                    onCancel={() => setFormOpen(false)}
                    onDone={(next) => {
                      setStatus(next);
                      if (next.kind === "sukses") setFormOpen(false);
                    }}
                  />
                </div>
              )}

              {composing && canManage && (
                <div className="mt-6">
                  <CompositionEditor
                    key={composing.id}
                    pkg={composing}
                    onDone={setStatus}
                    onClose={() => setComposing(null)}
                  />
                </div>
              )}

              {loading && <LoadingState />}
              {error && (
                <ErrorState onRetry={() => void refetch()}>
                  {graphQLErrorMessage(error, "Gagal memuat paket ujian.")}
                </ErrorState>
              )}
              {data && pageValid && (
                <div className="mt-6">
                  <DataTable
                    rows={data.cbtPackages.items}
                    columns={columns}
                    getRowId={(pkg) => pkg.id}
                    label="Daftar paket CBT"
                    emptyMessage={total === 0 ? "Belum ada paket yang cocok. Tambah paket atau ubah filter." : "Tidak ada paket pada halaman ini."}
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
