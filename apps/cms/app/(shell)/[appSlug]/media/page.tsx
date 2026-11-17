"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { use, useEffect, useRef, useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import {
  DELETE_MEDIA_MUTATION,
  MEDIA_QUERY,
} from "../../../../features/media/graphql/media.graphql";
import type {
  MediaData,
  MediaFilter,
} from "../../../../features/media/graphql/media.graphql";
import {
  allowedTypeLabels,
  formatBytes,
  uploadMediaFile,
  validateClientFile,
} from "../../../../features/media/upload-client";
import { useSessionStore } from "../../../../stores/use-session-store";

const PER_PAGE = 24;

const CONTROL_CLASS =
  "min-h-[44px] border border-slate-300 px-3 py-2 text-sm text-slate-900";
const LABEL_CLASS = "text-xs font-semibold text-slate-600";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isImage(item: MediaData): boolean {
  return item.mimeType.startsWith("image/");
}

type StatusMessage = { kind: "sukses" | "gagal"; text: string };

interface UploadDialogProps {
  appSlug: string;
  onDone: (status: StatusMessage) => void;
  onClose: () => void;
}

function UploadDialog({ appSlug, onDone, onClose }: UploadDialogProps): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [uploading, setUploading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fileInputRef.current?.focus();
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape" && abortRef.current === null) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function handleCancel(): void {
    if (uploading) {
      abortRef.current?.abort();
      return;
    }
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (uploading) {
      return;
    }
    if (file === null) {
      setError("Pilih berkas dulu.");
      return;
    }
    const invalid = validateClientFile(file);
    if (invalid !== null) {
      setError(invalid);
      return;
    }
    setError(null);
    setUploading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await uploadMediaFile({
        apiUrl: API_URL,
        appSlug,
        file,
        altText: altText.trim() === "" ? null : altText.trim(),
        onProgress: setPercent,
        signal: controller.signal,
      });
      onDone({ kind: "sukses", text: `Berkas "${result.fileName}" terunggah.` });
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : "Unggah gagal.";
      if (controller.signal.aborted) {
        setError("Unggahan dibatalkan.");
      } else {
        setError(text);
      }
      setUploading(false);
      setPercent(0);
      abortRef.current = null;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => {
        if (!uploading) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-unggah"
        className="w-full max-w-md border border-slate-200 bg-white p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="judul-unggah" className="text-sm font-semibold text-slate-900">
          Unggah media
        </h2>
        <form className="mt-3 flex flex-col gap-3" onSubmit={(e) => void handleSubmit(e)}>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Berkas (wajib)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={CONTROL_CLASS}
            />
          </label>
          <p className="text-xs text-slate-600">
            {`Tipe: ${allowedTypeLabels()}. Ukuran maksimal ${formatBytes(5 * 1024 * 1024)}.`}
          </p>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Teks alternatif (opsional)</span>
            <input
              type="text"
              value={altText}
              maxLength={512}
              disabled={uploading}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Deskripsi singkat gambar"
              className={CONTROL_CLASS}
            />
          </label>
          {uploading && (
            <div
              role="progressbar"
              aria-label="Progres unggah"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 border border-slate-300"
            >
              <div className="h-full bg-slate-900" style={{ width: `${percent}%` }} />
            </div>
          )}
          {uploading && (
            <p className="text-xs text-slate-600">{`Mengunggah… ${percent}%`}</p>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {uploading ? "Mengunggah…" : "Unggah"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="min-h-[44px] border border-slate-300 px-4 py-2 text-sm text-slate-900"
            >
              {uploading ? "Batalkan" : "Batal"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function MediaPage({
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
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.media.view");
  const canCreate =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.media.create");
  const canDelete =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.media.delete");

  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [deleteMedia, { loading: deleting }] = useMutation(
    DELETE_MEDIA_MUTATION,
  );

  const contextReady = ready && activeSlug === appSlug;
  const { data, loading, error, refetch } = useQuery(MEDIA_QUERY, {
    variables: {
      page,
      perPage: PER_PAGE,
      filter: (applied.trim() === ""
        ? null
        : { search: applied.trim() }) as MediaFilter | null,
    },
    skip: !canView || !contextReady,
  });

  function handleApply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setApplied(draft);
  }

  function handleReset(): void {
    setDraft("");
    setApplied("");
    setPage(1);
  }

  async function handleDelete(item: MediaData): Promise<void> {
    const confirmed = window.confirm(
      `Hapus berkas "${item.fileName}"? Berkas yang sudah dipakai modul lain bisa ikut rusak.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await deleteMedia({
        variables: { id: item.id },
        refetchQueries: [{ query: MEDIA_QUERY }],
      });
      setStatus({
        kind: "sukses",
        text: `Berkas "${item.fileName}" dihapus.`,
      });
    } catch (err: unknown) {
      setStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal menghapus berkas."),
      });
    }
  }

  const total = data?.media.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Media {appSlug}</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Perpustakaan media
      </h1>
      {!ready && <p className="mt-6 text-slate-900">Memuat…</p>}
      {ready && !canView && (
        <p className="mt-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat media aplikasi ini.
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
                    placeholder="Cari nama berkas…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className={CONTROL_CLASS}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Cari
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="min-h-[44px] border border-slate-300 px-4 py-2 text-sm text-slate-900"
                  >
                    Atur ulang
                  </button>
                </div>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus(null);
                      setDialogOpen(true);
                    }}
                    className="min-h-[44px] border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    Unggah media
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

              {dialogOpen && canCreate && (
                <UploadDialog
                  appSlug={appSlug}
                  onClose={() => setDialogOpen(false)}
                  onDone={(next) => {
                    setStatus(next);
                    if (next.kind === "sukses") {
                      setDialogOpen(false);
                      void refetch();
                    }
                  }}
                />
              )}

              {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
              {error && (
                <div className="mt-6">
                  <p className="text-sm text-red-700">
                    {graphQLErrorMessage(error, "Gagal memuat media.")}
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
              {data && total === 0 && applied.trim() === "" && (
                <p className="mt-6 text-sm text-slate-600">
                  Belum ada media di aplikasi ini.
                </p>
              )}
              {data && total === 0 && applied.trim() !== "" && (
                <p className="mt-6 text-sm text-slate-600">
                  Tidak ada media yang cocok dengan pencarian.
                </p>
              )}
              {data && total > 0 && (
                <>
                  <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {data.media.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-col border border-slate-200"
                      >
                        {isImage(item) ? (
                          <img
                            src={item.url}
                            alt={item.altText ?? item.fileName}
                            width={320}
                            height={320}
                            loading="lazy"
                            className="aspect-square w-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-slate-100"
                            aria-label={`Berkas ${item.fileName}`}
                          >
                            <span className="text-lg font-bold text-slate-700">
                              PDF
                            </span>
                            <span className="max-w-full truncate px-2 text-xs text-slate-600">
                              {item.fileName}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-1 flex-col gap-1 p-3">
                          <p
                            className="truncate text-sm font-semibold text-slate-900"
                            title={item.fileName}
                          >
                            {item.fileName}
                          </p>
                          <p className="text-xs text-slate-600">
                            {`${formatBytes(item.sizeBytes)} · ${formatDateTime(item.createdAt)}`}
                          </p>
                          {item.altText && (
                            <p className="truncate text-xs text-slate-600">
                              {item.altText}
                            </p>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              disabled={deleting}
                              onClick={() => void handleDelete(item)}
                              className="mt-2 min-h-[44px] self-start text-sm text-red-700 underline disabled:opacity-50"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
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
