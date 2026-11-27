"use client";

import { PageHeader } from "@/components/shared/page-header";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { useBoundedPage } from "@/hooks/use-bounded-page";
import { LoadingState } from "@/components/shared/page-state";
import { Table } from "@/components/ui/table";

import { useMutation, useQuery } from "@apollo/client/react";
import { use, useEffect, useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import { APP_USERS_QUERY } from "../../../../../features/app-users/graphql/app-users.graphql";
import {
  CBT_PACKAGES_QUERY,
  CBT_SESSIONS_QUERY,
  CBT_SESSION_QUERY,
  FINISH_CBT_SESSION_MUTATION,
  START_CBT_SIMULATION_MUTATION,
  SUBMIT_CBT_ANSWERS_MUTATION,
} from "../../../../../features/cbt/graphql/cbt.graphql";
import type {
  CbtOption,
  CbtSessionDetailData,
  CbtSessionsFilter,
} from "../../../../../features/cbt/graphql/cbt.graphql";
import { useSessionStore } from "../../../../../stores/use-session-store";

const PER_PAGE = 20;
const CONTROL_CLASS =
  "min-h-11 max-w-full rounded-md border border-input bg-card px-3 py-2 text-sm";
const LABEL_CLASS = "text-sm font-medium text-muted-foreground";
const OPTIONS: CbtOption[] = ["A", "B", "C", "D", "E"];

type StatusMessage = { kind: "sukses" | "gagal"; text: string };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FilterDraft {
  search: string;
  status: string;
}

const EMPTY_FILTER: FilterDraft = { search: "", status: "" };

function toFilterInput(draft: FilterDraft): CbtSessionsFilter | null {
  const filter: CbtSessionsFilter = {};
  if (draft.search.trim() !== "") filter.search = draft.search.trim();
  if (draft.status === "ongoing") filter.status = "ONGOING";
  if (draft.status === "completed") filter.status = "COMPLETED";
  return Object.keys(filter).length > 0 ? filter : null;
}

interface AnswerSheetProps {
  detail: CbtSessionDetailData;
  canManage: boolean;
  onDone: (status: StatusMessage) => void;
  onClose: () => void;
}

function AnswerSheet({ detail, canManage, onDone, onClose }: AnswerSheetProps): JSX.Element {
  const [submitAnswers, { loading: saving }] = useMutation(
    SUBMIT_CBT_ANSWERS_MUTATION,
  );
  const [finishSession, { loading: finishing }] = useMutation(
    FINISH_CBT_SESSION_MUTATION,
  );
  const [picked, setPicked] = useState<Record<string, CbtOption | null>>({});

  useEffect(() => {
    const initial: Record<string, CbtOption | null> = {};
    for (const q of detail.questions) {
      initial[q.id] =
        detail.answers.find((a) => a.questionId === q.id)?.selectedOption ?? null;
    }
    setPicked(initial);
  }, [detail]);

  const ongoing = detail.session.status === "ONGOING";
  const busy = saving || finishing;
  const optionText: Record<
    CbtOption,
    "optionA" | "optionB" | "optionC" | "optionD" | "optionE"
  > = {
    A: "optionA",
    B: "optionB",
    C: "optionC",
    D: "optionD",
    E: "optionE",
  };

  async function handleSave(): Promise<void> {
    try {
      await submitAnswers({
        variables: {
          sessionId: detail.session.id,
          answers: detail.questions.map((q) => ({
            questionId: q.id,
            selectedOption: picked[q.id] ?? null,
          })),
        },
      });
      onDone({ kind: "sukses", text: "Jawaban tersimpan." });
    } catch (err: unknown) {
      onDone({ kind: "gagal", text: graphQLErrorMessage(err, "Gagal menyimpan jawaban.") });
    }
  }

  async function handleFinish(): Promise<void> {
    if (
      !window.confirm(
        "Selesaikan sesi ini? Skor dihitung otomatis dan jawaban tidak bisa diubah lagi.",
      )
    ) {
      return;
    }
    try {
      // Simpan jawaban terakhir dulu agar penilaian memakai isi lembar.
      await submitAnswers({
        variables: {
          sessionId: detail.session.id,
          answers: detail.questions.map((q) => ({
            questionId: q.id,
            selectedOption: picked[q.id] ?? null,
          })),
        },
      });
      await finishSession({ variables: { id: detail.session.id } });
      onDone({ kind: "sukses", text: "Sesi selesai. Hasil penilaian tampil di bawah." });
    } catch (err: unknown) {
      onDone({ kind: "gagal", text: graphQLErrorMessage(err, "Gagal menyelesaikan sesi.") });
    }
  }

  const result = detail.result;
  const pg = detail.package.passingGrade;

  return (
    <section className="border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Lembar jawaban: {detail.session.participantName}{" "}
          <span className="font-normal text-slate-600">
            ({detail.package.title})
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] border border-slate-300 px-3 py-2 text-sm text-slate-900"
        >
          Tutup
        </button>
      </div>

      {result && (
        <div className="mt-3 border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">
            Hasil penilaian otomatis{" "}
            <span
              className={
                result.passed
                  ? "bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
                  : "bg-red-100 px-2 py-1 text-xs font-semibold text-red-800"
              }
            >
              {result.passed ? "LULUS" : "TIDAK LULUS"}
            </span>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {`TWK ${result.twkScore} (ambang ${pg.twk}) / TIU ${result.tiuScore} (ambang ${pg.tiu}) / TKP ${result.tkpScore} (ambang ${pg.tkp})`}
          </p>
          <p className="mt-1 text-sm text-slate-900">
            Total skor: <span className="font-semibold">{result.totalScore}</span>
          </p>
        </div>
      )}

      <ol className="mt-4 flex flex-col gap-4">
        {detail.questions.map((q, index) => (
          <li key={q.id} className="border border-slate-100 p-3">
            <p className="text-sm text-slate-900">
              <span className="font-semibold">
                {index + 1}. [{q.category}]
              </span>{" "}
              {q.stem}
            </p>
            {q.imageUrl && (
              <img
                src={q.imageUrl}
                alt=""
                width={320}
                height={180}
                className="mt-2 max-h-44 w-auto border border-slate-200 object-contain"
              />
            )}
            <div className="mt-2 flex flex-col gap-1">
              {OPTIONS.map((o) => (
                <label
                  key={o}
                  className="flex min-h-[44px] items-start gap-2 text-sm text-slate-900"
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={picked[q.id] === o}
                    disabled={!ongoing || !canManage || busy}
                    onChange={() =>
                      setPicked((prev) => ({ ...prev, [q.id]: o }))
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="font-semibold">{o}.</span>{" "}
                    {q[optionText[o]]}
                  </span>
                </label>
              ))}
              {ongoing && canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setPicked((prev) => ({ ...prev, [q.id]: null }))
                  }
                  className="min-h-[44px] self-start text-xs underline disabled:opacity-50"
                >
                  Kosongkan jawaban
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      {ongoing && canManage && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="min-h-[44px] border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan jawaban"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleFinish()}
            className="min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {finishing ? "Menilai…" : "Selesaikan sesi (nilai otomatis)"}
          </button>
        </div>
      )}
      {!ongoing && (
        <p className="mt-4 text-xs text-slate-600">
          Sesi sudah selesai; jawaban tidak bisa diubah.
        </p>
      )}
    </section>
  );
}

export default function CbtSesiPage({
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
    admin?.isSuperAdmin === true || permissions.includes("cbt.sessions.view");
  const canManage =
    admin?.isSuperAdmin === true ||
    permissions.includes("cbt.sessions.manage");

  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTER);
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);

  // Form mulai simulasi
  const [startOpen, setStartOpen] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [participantMode, setParticipantMode] = useState<"user" | "nama">("user");
  const [appUserId, setAppUserId] = useState("");
  const [participantName, setParticipantName] = useState("");

  const [startSimulation, { loading: starting }] = useMutation(
    START_CBT_SIMULATION_MUTATION,
  );

  const contextReady = ready && activeSlug === appSlug;
  const { data, loading, error, refetch } = useQuery(CBT_SESSIONS_QUERY, {
    variables: { page, perPage: PER_PAGE, filter: toFilterInput(applied) },
    skip: !canView || !contextReady,
  });
  const packages = useQuery(CBT_PACKAGES_QUERY, {
    variables: { perPage: 100, filter: { isActive: true } },
    skip: !canManage || !contextReady || !startOpen,
  });
  const users = useQuery(APP_USERS_QUERY, {
    variables: { perPage: 100, filter: { status: "active" } },
    skip: !canManage || !contextReady || !startOpen || participantMode !== "user",
  });
  const detail = useQuery(CBT_SESSION_QUERY, {
    variables: { id: openedId ?? "" },
    skip: openedId === null || !canView || !contextReady,
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

  async function handleStart(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus(null);
    try {
      const result = await startSimulation({
        variables: {
          input: {
            packageId,
            appUserId: participantMode === "user" ? appUserId : null,
            participantName: participantMode === "nama" ? participantName : null,
          },
        },
        refetchQueries: [CBT_SESSIONS_QUERY],
        awaitRefetchQueries: true,
      });
      const created = result.data?.startCbtSimulation;
      if (created) {
        setOpenedId(created.session.id);
        setStartOpen(false);
        setStatus({
          kind: "sukses",
          text: `Simulasi dimulai untuk ${created.session.participantName}.`,
        });
      }
    } catch (err: unknown) {
      setStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal memulai simulasi."),
      });
    }
  }

  const total = data?.cbtSessions.total ?? 0;
  const pageValid = useBoundedPage(page, setPage, PER_PAGE, loading ? undefined : data?.cbtSessions.total);
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);
  const packageItems = packages.data?.cbtPackages.items ?? [];
  const userItems = users.data?.appUsers.items ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Sesi ujian" description={appSlug} />
      <p className="mt-2 text-sm text-slate-600">
        Fase CMS: simulasi penilaian. Mulai sesi untuk peserta, isi jawaban,
        lalu selesaikan untuk menilai otomatis.
      </p>
      {!ready && <LoadingState />}
      {ready && !canView && (
        <p className="mt-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat sesi ujian aplikasi ini.
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
                  <span className={LABEL_CLASS}>Cari peserta</span>
                  <input
                    type="search"
                    placeholder="Nama peserta…"
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
                    <option value="ongoing">Berlangsung</option>
                    <option value="completed">Selesai</option>
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
                      setStartOpen((v) => !v);
                      setStatus(null);
                    }}
                    className="min-h-[44px] border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    Mulai simulasi
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

              {startOpen && canManage && (
                <section className="mt-6 border border-slate-200 p-4">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Mulai simulasi penilaian
                  </h2>
                  <form
                    className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
                    onSubmit={(e) => void handleStart(e)}
                  >
                    <label className="flex flex-col gap-1">
                      <span className={LABEL_CLASS}>Paket aktif (wajib)</span>
                      <select
                        required
                        value={packageId}
                        disabled={starting}
                        onChange={(e) => setPackageId(e.target.value)}
                        className={CONTROL_CLASS}
                      >
                        <option value="">Pilih paket…</option>
                        {packageItems.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} ({p.questionCount} soal)
                          </option>
                        ))}
                      </select>
                    </label>
                    <fieldset className="flex flex-col gap-1">
                      <legend className={LABEL_CLASS}>Peserta</legend>
                      <div className="flex gap-4 text-sm text-slate-900">
                        <label className="flex min-h-[44px] items-center gap-1">
                          <input
                            type="radio"
                            name="mode"
                            checked={participantMode === "user"}
                            onChange={() => setParticipantMode("user")}
                            className="h-4 w-4"
                          />
                          User aplikasi
                        </label>
                        <label className="flex min-h-[44px] items-center gap-1">
                          <input
                            type="radio"
                            name="mode"
                            checked={participantMode === "nama"}
                            onChange={() => setParticipantMode("nama")}
                            className="h-4 w-4"
                          />
                          Nama bebas
                        </label>
                      </div>
                      {participantMode === "user" ? (
                        <select
                          aria-label="User aplikasi aktif"
                          required
                          value={appUserId}
                          disabled={starting}
                          onChange={(e) => setAppUserId(e.target.value)}
                          className={CONTROL_CLASS}
                        >
                          <option value="">Pilih user aktif…</option>
                          {userItems.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          aria-label="Nama peserta simulasi"
                          type="text"
                          required
                          maxLength={255}
                          placeholder="Nama peserta simulasi"
                          value={participantName}
                          disabled={starting}
                          onChange={(e) => setParticipantName(e.target.value)}
                          className={CONTROL_CLASS}
                        />
                      )}
                    </fieldset>
                    <div className="flex gap-2 md:col-span-2">
                      <button
                        type="submit"
                        disabled={starting}
                        className="min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {starting ? "Memulai…" : "Mulai sesi"}
                      </button>
                      <button
                        type="button"
                        disabled={starting}
                        onClick={() => setStartOpen(false)}
                        className="min-h-[44px] border border-slate-300 px-4 py-2 text-sm text-slate-900 disabled:opacity-50"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {openedId !== null && detail.loading && (
                <p className="mt-6 text-slate-900">Memuat lembar jawaban…</p>
              )}
              {openedId !== null && detail.error && (
                <p className="mt-6 text-sm text-red-700">
                  {graphQLErrorMessage(detail.error, "Gagal memuat sesi.")}
                </p>
              )}
              {openedId !== null && detail.data && (
                <div className="mt-6">
                  <AnswerSheet
                    detail={detail.data.cbtSession}
                    canManage={canManage}
                    onDone={setStatus}
                    onClose={() => setOpenedId(null)}
                  />
                </div>
              )}

              {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
              {error && (
                <div className="mt-6">
                  <p className="text-sm text-red-700">
                    {graphQLErrorMessage(error, "Gagal memuat sesi ujian.")}
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
                  Belum ada sesi. Mulai simulasi untuk membuat sesi pertama.
                </p>
              )}
              {data && total > 0 && pageValid && (
                <>
                  <div className="mt-6 overflow-x-auto">
                    <Table scrollLabel="Daftar sesi CBT" className="min-w-max bg-card text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="py-2 pr-4 font-semibold">Peserta</th>
                          <th className="py-2 pr-4 font-semibold">Paket</th>
                          <th className="py-2 pr-4 font-semibold">Status</th>
                          <th className="py-2 pr-4 font-semibold">Mulai</th>
                          <th className="py-2 font-semibold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cbtSessions.items.map((s) => (
                          <tr key={s.id} className="border-b border-slate-100">
                            <td className="py-2 pr-4 text-slate-900">
                              {s.participantName}
                            </td>
                            <td className="py-2 pr-4 text-slate-600">
                              {s.packageTitle}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={
                                  s.status === "COMPLETED"
                                    ? "bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
                                    : "bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800"
                                }
                              >
                                {s.status === "COMPLETED" ? "Selesai" : "Berlangsung"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap py-2 pr-4 text-slate-600">
                              {formatDateTime(s.startedAt)}
                            </td>
                            <td className="whitespace-nowrap py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenedId(s.id);
                                  setStatus(null);
                                }}
                                className="min-h-[44px] underline"
                              >
                                {s.status === "COMPLETED" ? "Lihat hasil" : "Buka lembar"}
                              </button>
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
