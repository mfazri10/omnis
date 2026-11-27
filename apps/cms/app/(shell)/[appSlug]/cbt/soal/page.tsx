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
import { MediaPicker } from "../../../../../components/shared/media-picker";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import {
  CBT_QUESTIONS_QUERY,
  CREATE_CBT_QUESTION_MUTATION,
  SET_CBT_QUESTION_ACTIVE_MUTATION,
  UPDATE_CBT_QUESTION_MUTATION,
} from "../../../../../features/cbt/graphql/cbt.graphql";
import type {
  CbtCategory,
  CbtOption,
  CbtQuestionData,
  CbtQuestionsFilter,
  CreateCbtQuestionInput,
} from "../../../../../features/cbt/graphql/cbt.graphql";
import { useSessionStore } from "../../../../../stores/use-session-store";

const PER_PAGE = 20;
const CONTROL_CLASS =
  "min-h-11 max-w-full rounded-md border border-input bg-card px-3 py-2 text-sm";
const LABEL_CLASS = "text-sm font-medium text-muted-foreground";
const OPTIONS: CbtOption[] = ["A", "B", "C", "D", "E"];
const CATEGORIES: CbtCategory[] = ["TWK", "TIU", "TKP"];

type StatusMessage = { kind: "sukses" | "gagal"; text: string };

interface FilterDraft {
  search: string;
  category: string;
  status: string;
}

const EMPTY_FILTER: FilterDraft = { search: "", category: "", status: "" };

function toFilterInput(draft: FilterDraft): CbtQuestionsFilter | null {
  const filter: CbtQuestionsFilter = {};
  if (draft.search.trim() !== "") filter.search = draft.search.trim();
  if (draft.category !== "") filter.category = draft.category as CbtCategory;
  if (draft.status === "active") filter.isActive = true;
  if (draft.status === "inactive") filter.isActive = false;
  return Object.keys(filter).length > 0 ? filter : null;
}

function scoringSummary(q: CbtQuestionData): string {
  if (q.category === "TKP") {
    return q.tkpWeights
      ? `Bobot ${OPTIONS.map((o) => q.tkpWeights?.[o]).join("/")}`
      : "Bobot belum diisi";
  }
  return q.correctOption ? `Kunci ${q.correctOption}` : "Kunci belum diisi";
}

interface QuestionFormProps {
  initial: CbtQuestionData | null;
  appSlug: string;
  onDone: (status: StatusMessage) => void;
  onCancel: () => void;
}

function QuestionForm({
  initial,
  appSlug,
  onDone,
  onCancel,
}: QuestionFormProps): JSX.Element {
  const [createQuestion, { loading: creating }] = useMutation(
    CREATE_CBT_QUESTION_MUTATION,
  );
  const [updateQuestion, { loading: updating }] = useMutation(
    UPDATE_CBT_QUESTION_MUTATION,
  );
  const [category, setCategory] = useState<CbtCategory>(
    initial?.category ?? "TWK",
  );
  const [stem, setStem] = useState(initial?.stem ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [options, setOptions] = useState<Record<CbtOption, string>>({
    A: initial?.optionA ?? "",
    B: initial?.optionB ?? "",
    C: initial?.optionC ?? "",
    D: initial?.optionD ?? "",
    E: initial?.optionE ?? "",
  });
  const [correctOption, setCorrectOption] = useState<string>(
    initial?.correctOption ?? "",
  );
  const [weights, setWeights] = useState<Record<CbtOption, string>>({
    A: String(initial?.tkpWeights?.A ?? 5),
    B: String(initial?.tkpWeights?.B ?? 4),
    C: String(initial?.tkpWeights?.C ?? 3),
    D: String(initial?.tkpWeights?.D ?? 2),
    E: String(initial?.tkpWeights?.E ?? 1),
  });
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const saving = creating || updating;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (category !== "TKP" && correctOption === "") {
      onDone({ kind: "gagal", text: "Kunci jawaban wajib dipilih untuk TWK/TIU." });
      return;
    }
    const input: CreateCbtQuestionInput = {
      category,
      stem: stem.trim(),
      imageUrl: imageUrl.trim() === "" ? null : imageUrl.trim(),
      optionA: options.A,
      optionB: options.B,
      optionC: options.C,
      optionD: options.D,
      optionE: options.E,
      correctOption:
        category === "TKP" ? null : (correctOption as CbtOption),
      tkpWeights:
        category === "TKP"
          ? {
              A: Number(weights.A),
              B: Number(weights.B),
              C: Number(weights.C),
              D: Number(weights.D),
              E: Number(weights.E),
            }
          : null,
      explanation: explanation.trim() === "" ? null : explanation.trim(),
    };
    try {
      if (initial === null) {
        await createQuestion({
          variables: { input },
          refetchQueries: [CBT_QUESTIONS_QUERY],
          awaitRefetchQueries: true,
        });
        onDone({ kind: "sukses", text: "Soal ditambahkan." });
      } else {
        await updateQuestion({
          variables: { id: initial.id, input },
          refetchQueries: [CBT_QUESTIONS_QUERY],
          awaitRefetchQueries: true,
        });
        onDone({ kind: "sukses", text: "Perubahan soal tersimpan." });
      }
    } catch (err: unknown) {
      onDone({ kind: "gagal", text: graphQLErrorMessage(err, "Gagal menyimpan soal.") });
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">
        {initial === null ? "Tambah soal" : `Ubah soal #${initial.id}`}
      </h2>
      <form
        className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Kategori</span>
          <select
            value={category}
            disabled={saving}
            onChange={(e) => setCategory(e.target.value as CbtCategory)}
            className={CONTROL_CLASS}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <label htmlFor="question-image" className={LABEL_CLASS}>Gambar soal (opsional)</label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="question-image"
              type="url"
              value={imageUrl}
              disabled={saving}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              className="min-h-11 min-w-0 flex-1 bg-card"
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => setPickerOpen(true)}
            >
              Pilih media
            </Button>
          </div>
        </div>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className={LABEL_CLASS}>Pertanyaan (wajib)</span>
          <textarea
            rows={3}
            required
            value={stem}
            disabled={saving}
            onChange={(e) => setStem(e.target.value)}
            className={CONTROL_CLASS}
          />
        </label>
        {OPTIONS.map((o) => (
          <label key={o} className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Opsi {o} (wajib)</span>
            <input
              type="text"
              required
              value={options[o]}
              disabled={saving}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, [o]: e.target.value }))
              }
              className={CONTROL_CLASS}
            />
          </label>
        ))}
        {category === "TKP" ? (
          <fieldset className="md:col-span-2">
            <legend className={LABEL_CLASS}>
              Bobot TKP per opsi (1..5, wajib)
            </legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {OPTIONS.map((o) => (
                <label key={o} className="flex items-center gap-1 text-sm">
                  {o}
                  <input
                    type="number"
                    min={1}
                    max={5}
                    required
                    value={weights[o]}
                    disabled={saving}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, [o]: e.target.value }))
                    }
                    className="min-h-11 w-16 rounded-md border border-input bg-card px-2 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Kunci jawaban (wajib)</span>
            <select
              required
              value={correctOption}
              disabled={saving}
              onChange={(e) => setCorrectOption(e.target.value)}
              className={CONTROL_CLASS}
            >
              <option value="">Pilih kunci…</option>
              {OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className={LABEL_CLASS}>Pembahasan (opsional)</span>
          <textarea
            rows={2}
            value={explanation}
            disabled={saving}
            onChange={(e) => setExplanation(e.target.value)}
            className={CONTROL_CLASS}
          />
        </label>
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
      <MediaPicker
        open={pickerOpen}
        appSlug={appSlug}
        onSelect={(selection) => {
          setImageUrl(selection.url);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </section>
  );
}

export default function CbtSoalPage({
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
    admin?.isSuperAdmin === true || permissions.includes("cbt.questions.view");
  const canManage =
    admin?.isSuperAdmin === true ||
    permissions.includes("cbt.questions.manage");

  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTER);
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CbtQuestionData | null>(null);

  const [setActive, { loading: toggling }] = useMutation(
    SET_CBT_QUESTION_ACTIVE_MUTATION,
  );

  const contextReady = ready && activeSlug === appSlug;
  const { data, loading, error, refetch } = useQuery(CBT_QUESTIONS_QUERY, {
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

  async function handleToggle(q: CbtQuestionData): Promise<void> {
    const action = q.isActive ? "menonaktifkan" : "mengaktifkan";
    if (!window.confirm(`Anda yakin ingin ${action} soal #${q.id}?`)) return;
    try {
      await setActive({
        variables: { id: q.id, active: !q.isActive },
        refetchQueries: [CBT_QUESTIONS_QUERY],
        awaitRefetchQueries: true,
      });
      setStatus({
        kind: "sukses",
        text: `Soal #${q.id} ${q.isActive ? "dinonaktifkan" : "diaktifkan"}.`,
      });
    } catch (err: unknown) {
      setStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal mengubah status soal."),
      });
    }
  }

  const total = data?.cbtQuestions.total ?? 0;
  const pageValid = useBoundedPage(page, setPage, PER_PAGE, loading ? undefined : data?.cbtQuestions.total);

  const columns: ColumnDef<CbtQuestionData>[] = [
    {
      id: "id",
      header: "#",
      cell: ({ row: { original: q } }) => (
        <span className="text-muted-foreground tabular-nums">{q.id}</span>
      ),
    },
    { id: "category", header: "Kategori", cell: ({ row: { original: q } }) => q.category },
    {
      id: "stem",
      header: "Pertanyaan",
      cell: ({ row: { original: q } }) => (
        <span className="block max-w-md whitespace-normal">
          <span className="line-clamp-2">{q.stem}</span>
          {q.imageUrl && (
            <span className="ml-2 text-xs text-muted-foreground">(bergambar)</span>
          )}
        </span>
      ),
    },
    {
      id: "scoring",
      header: "Penilaian",
      cell: ({ row: { original: q } }) => (
        <span className="whitespace-nowrap text-muted-foreground">{scoringSummary(q)}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row: { original: q } }) => (
        <StatusBadge
          label={q.isActive ? "Aktif" : "Nonaktif"}
          tone={q.isActive ? "success" : "neutral"}
        />
      ),
    },
  ];
  if (canManage) {
    columns.push({
      id: "actions",
      header: "Aksi",
      cell: ({ row: { original: q } }) => (
        <div className="flex items-center gap-x-3 gap-y-1">
          <Button
            type="button"
            variant="link"
            className="min-h-11"
            onClick={() => {
              setEditing(q);
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
            disabled={toggling}
            onClick={() => void handleToggle(q)}
          >
            {q.isActive ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        </div>
      ),
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Bank soal" description={appSlug} />
      {!ready && <LoadingState />}
      {ready && !canView && (
        <EmptyState>Anda tidak memiliki izin untuk melihat bank soal aplikasi ini.</EmptyState>
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
                    placeholder="Cari pertanyaan…"
                    value={draft.search}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, search: e.target.value }))
                    }
                    className="min-h-11 bg-card"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Kategori</span>
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className={CONTROL_CLASS}
                  >
                    <option value="">Semua kategori</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
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
                    Tambah soal
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
                  <QuestionForm
                    key={editing ? editing.id : "baru"}
                    initial={editing}
                    appSlug={appSlug}
                    onCancel={() => setFormOpen(false)}
                    onDone={(next) => {
                      setStatus(next);
                      if (next.kind === "sukses") setFormOpen(false);
                    }}
                  />
                </div>
              )}

              {loading && <LoadingState />}
              {error && (
                <ErrorState onRetry={() => void refetch()}>
                  {graphQLErrorMessage(error, "Gagal memuat bank soal.")}
                </ErrorState>
              )}
              {data && pageValid && (
                <div className="mt-6">
                  <DataTable
                    rows={data.cbtQuestions.items}
                    columns={columns}
                    getRowId={(q) => q.id}
                    label="Daftar soal CBT"
                    emptyMessage={total === 0 ? "Belum ada soal yang cocok. Tambah soal atau ubah filter." : "Tidak ada soal pada halaman ini."}
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
