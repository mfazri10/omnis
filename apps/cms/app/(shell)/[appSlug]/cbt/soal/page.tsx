"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { use, useState } from "react";
import type { FormEvent, JSX } from "react";
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
  "min-h-[44px] border border-slate-300 px-3 py-2 text-sm text-slate-900";
const LABEL_CLASS = "text-xs font-semibold text-slate-600";
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
          refetchQueries: [{ query: CBT_QUESTIONS_QUERY }],
        });
        onDone({ kind: "sukses", text: "Soal ditambahkan." });
      } else {
        await updateQuestion({
          variables: { id: initial.id, input },
          refetchQueries: [{ query: CBT_QUESTIONS_QUERY }],
        });
        onDone({ kind: "sukses", text: "Perubahan soal tersimpan." });
      }
    } catch (err: unknown) {
      onDone({ kind: "gagal", text: graphQLErrorMessage(err, "Gagal menyimpan soal.") });
    }
  }

  return (
    <section className="border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900">
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
          <span className={LABEL_CLASS}>Gambar soal (opsional)</span>
          <div className="flex gap-2">
            <input
              type="url"
              value={imageUrl}
              disabled={saving}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              className={`${CONTROL_CLASS} flex-1`}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => setPickerOpen(true)}
              className="min-h-[44px] border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              Pilih media
            </button>
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
                    className="min-h-[44px] w-16 border border-slate-300 px-2 py-2 text-sm"
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
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="min-h-[44px] border border-slate-300 px-4 py-2 text-sm text-slate-900 disabled:opacity-50"
          >
            Batal
          </button>
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
        refetchQueries: [{ query: CBT_QUESTIONS_QUERY }],
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
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Modul CBT {appSlug}</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Bank soal</h1>
      {!ready && <p className="mt-6 text-slate-900">Memuat…</p>}
      {ready && !canView && (
        <p className="mt-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat bank soal aplikasi ini.
        </p>
      )}
      {ready && canView && (
        <>
          {!contextReady && (
            <p className="mt-6 text-slate-900">Menyiapkan konteks…</p>
          )}
          {contextReady && (
            <>
              <form
                className="mt-6 flex flex-wrap items-end gap-3"
                onSubmit={handleApply}
              >
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Pencarian</span>
                  <input
                    type="search"
                    placeholder="Cari pertanyaan…"
                    value={draft.search}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, search: e.target.value }))
                    }
                    className={CONTROL_CLASS}
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
                    Tambah soal
                  </button>
                )}
              </form>

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

              {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
              {error && (
                <div className="mt-6">
                  <p className="text-sm text-red-700">
                    {graphQLErrorMessage(error, "Gagal memuat bank soal.")}
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
                  Belum ada soal yang cocok. Tambah soal atau ubah filter.
                </p>
              )}
              {data && total > 0 && (
                <>
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="py-2 pr-4 font-semibold">#</th>
                          <th className="py-2 pr-4 font-semibold">Kategori</th>
                          <th className="py-2 pr-4 font-semibold">Pertanyaan</th>
                          <th className="py-2 pr-4 font-semibold">Penilaian</th>
                          <th className="py-2 pr-4 font-semibold">Status</th>
                          {canManage && (
                            <th className="py-2 font-semibold">Aksi</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {data.cbtQuestions.items.map((q) => (
                          <tr key={q.id} className="border-b border-slate-100">
                            <td className="py-2 pr-4 text-slate-600">{q.id}</td>
                            <td className="py-2 pr-4 text-slate-900">
                              {q.category}
                            </td>
                            <td className="max-w-md py-2 pr-4 text-slate-900">
                              <span className="line-clamp-2">{q.stem}</span>
                              {q.imageUrl && (
                                <span className="ml-2 text-xs text-slate-500">
                                  (bergambar)
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-4 text-slate-600">
                              {scoringSummary(q)}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={
                                  q.isActive
                                    ? "bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
                                    : "bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                                }
                              >
                                {q.isActive ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                            {canManage && (
                              <td className="whitespace-nowrap py-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditing(q);
                                    setStatus(null);
                                    setFormOpen(true);
                                  }}
                                  className="min-h-[44px] pr-3 underline"
                                >
                                  Ubah
                                </button>
                                <button
                                  type="button"
                                  disabled={toggling}
                                  onClick={() => void handleToggle(q)}
                                  className="min-h-[44px] underline disabled:opacity-50"
                                >
                                  {q.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                              </td>
                            )}
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
        </>
      )}
    </main>
  );
}
