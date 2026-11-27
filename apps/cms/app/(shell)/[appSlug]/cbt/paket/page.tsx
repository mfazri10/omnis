"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { useBoundedPage } from "@/hooks/use-bounded-page";
import { LoadingState } from "@/components/shared/page-state";
import { Table } from "@/components/ui/table";

import { useMutation, useQuery } from "@apollo/client/react";
import { use, useState } from "react";
import type { FormEvent, JSX } from "react";
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
      <h2 className="text-sm font-semibold text-slate-900">
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
            <label className="flex items-center gap-1 text-sm text-slate-900">
              TWK
              <input
                type="number"
                min={0}
                required
                value={pgTwk}
                disabled={saving}
                onChange={(e) => setPgTwk(e.target.value)}
                className="min-h-[44px] w-24 border border-slate-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-1 text-sm text-slate-900">
              TIU
              <input
                type="number"
                min={0}
                required
                value={pgTiu}
                disabled={saving}
                onChange={(e) => setPgTiu(e.target.value)}
                className="min-h-[44px] w-24 border border-slate-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-1 text-sm text-slate-900">
              TKP
              <input
                type="number"
                min={0}
                required
                value={pgTkp}
                disabled={saving}
                onChange={(e) => setPgTkp(e.target.value)}
                className="min-h-[44px] w-24 border border-slate-300 px-2 py-2 text-sm"
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-slate-600">
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
    <section className="border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        Komposisi soal: {pkg.title}
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Centang soal aktif yang masuk paket. Urutan centang menjadi urutan
        penyajian. Soal nonaktif tidak bisa dimasukkan.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-900">
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
        <span className="text-sm text-slate-600">
          {current.length} soal dipilih
        </span>
      </div>
      {bank.loading && <p className="mt-3 text-sm text-slate-900">Memuat bank soal…</p>}
      {bank.error && (
        <p className="mt-3 text-sm text-red-700">
          {graphQLErrorMessage(bank.error, "Gagal memuat bank soal.")}
        </p>
      )}
      {bank.data && bankItems.length === 0 && (
        <p className="mt-3 text-sm text-slate-600">
          Tidak ada soal aktif pada kategori ini.
        </p>
      )}
      {bankItems.length > 0 && (
        <ul className="mt-3 flex max-h-80 flex-col gap-1 overflow-y-auto border border-slate-100 p-2">
          {bankItems.map((q) => (
            <li key={q.id}>
              <label className="flex min-h-[44px] items-start gap-2 px-1 py-1 text-sm text-slate-900">
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
        <button
          type="button"
          disabled={saving || detail.loading}
          onClick={() => void handleSave()}
          className="min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Simpan komposisi"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="min-h-[44px] border border-slate-300 px-4 py-2 text-sm text-slate-900 disabled:opacity-50"
        >
          Tutup
        </button>
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
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Paket ujian" description={appSlug} />
      {!ready && <LoadingState />}
      {ready && !canView && (
        <p className="mt-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat paket ujian aplikasi ini.
        </p>
      )}
      {ready && canView && (
        <>
          {!contextReady && (
            <p className="mt-6 text-slate-900">Menyiapkan konteks…</p>
          )}
          {contextReady && (
            <>
              <TableToolbar onSubmit={handleApply}>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Pencarian</span>
                  <input
                    type="search"
                    placeholder="Cari judul paket…"
                    value={draft.search}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, search: e.target.value }))
                    }
                    className={CONTROL_CLASS}
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
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setStatus(null);
                      setFormOpen(true);
                    }}
                    className="min-h-[44px] border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    Tambah paket
                  </button>
                )}
              </TableToolbar>

              {status && (
                <p
                  className={
                    status.kind === "sukses"
                      ? "mt-4 text-sm text-green-700"
                      : "mt-4 text-sm text-red-700"
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

              {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
              {error && (
                <div className="mt-6">
                  <p className="text-sm text-red-700">
                    {graphQLErrorMessage(error, "Gagal memuat paket ujian.")}
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
                  Belum ada paket yang cocok. Tambah paket atau ubah filter.
                </p>
              )}
              {data && total > 0 && pageValid && (
                <>
                  <div className="mt-6 overflow-x-auto">
                    <Table scrollLabel="Daftar paket CBT" className="min-w-max bg-card text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="py-2 pr-4 font-semibold">Judul</th>
                          <th className="py-2 pr-4 font-semibold">Durasi</th>
                          <th className="py-2 pr-4 font-semibold">
                            Passing grade
                          </th>
                          <th className="py-2 pr-4 font-semibold">Soal</th>
                          <th className="py-2 pr-4 font-semibold">Status</th>
                          {canManage && (
                            <th className="py-2 font-semibold">Aksi</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {data.cbtPackages.items.map((pkg) => (
                          <tr key={pkg.id} className="border-b border-slate-100">
                            <td className="py-2 pr-4 text-slate-900">
                              {pkg.title}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-4 text-slate-600">
                              {pkg.durationMinutes} menit
                            </td>
                            <td className="whitespace-nowrap py-2 pr-4 text-slate-600">
                              {`TWK ${pkg.passingGrade.twk} / TIU ${pkg.passingGrade.tiu} / TKP ${pkg.passingGrade.tkp}`}
                            </td>
                            <td className="py-2 pr-4 text-slate-600">
                              {pkg.questionCount}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={
                                  pkg.isActive
                                    ? "bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
                                    : "bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                                }
                              >
                                {pkg.isActive ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                            {canManage && (
                              <td className="whitespace-nowrap py-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditing(pkg);
                                    setStatus(null);
                                    setFormOpen(true);
                                  }}
                                  className="min-h-[44px] pr-3 underline"
                                >
                                  Ubah
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setComposing(pkg);
                                    setStatus(null);
                                  }}
                                  className="min-h-[44px] pr-3 underline"
                                >
                                  Komposisi
                                </button>
                                <button
                                  type="button"
                                  disabled={toggling}
                                  onClick={() => void handleToggle(pkg)}
                                  className="min-h-[44px] underline disabled:opacity-50"
                                >
                                  {pkg.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                              </td>
                            )}
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
