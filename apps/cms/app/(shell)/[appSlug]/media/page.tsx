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
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, EmptyState, LoadingState } from "@/components/shared/page-state";
import { Pagination } from "@/components/shared/pagination";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const PER_PAGE = 24;

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
  open: boolean;
  appSlug: string;
  finalFocus: () => HTMLElement | null;
  onDone: (status: StatusMessage) => void;
  onClose: () => void;
}

function UploadDialog({ open, appSlug, finalFocus, onDone, onClose }: UploadDialogProps): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [uploading, setUploading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setAltText("");
      setError(null);
      setPercent(0);
      setUploading(false);
    }
  }, [open]);

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
      abortRef.current = null;
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
    <Dialog open={open} onOpenChange={(next, details) => {
      if (!next && uploading) details.cancel();
      else if (!next) onClose();
    }}>
      <DialogContent showCloseButton={false} initialFocus={fileInputRef} finalFocus={finalFocus}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unggah media</DialogTitle>
          <DialogDescription>{`Tipe: ${allowedTypeLabels()}. Ukuran maksimal ${formatBytes(5 * 1024 * 1024)}.`}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" aria-busy={uploading} onSubmit={(e) => void handleSubmit(e)}>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Berkas (wajib)</span>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="min-h-11"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Teks alternatif (opsional)</span>
            <Input
              type="text"
              value={altText}
              maxLength={512}
              disabled={uploading}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Deskripsi singkat gambar"
              className="min-h-11"
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
          {error && <ErrorState>{error}</ErrorState>}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={uploading}
              className="min-h-11"
            >
              {uploading ? "Mengunggah…" : "Unggah"}
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              variant="outline"
              className="min-h-11"
            >
              {uploading ? "Batalkan" : "Batal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
  const uploadTrigger = useRef<HTMLButtonElement>(null);

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
        refetchQueries: [MEDIA_QUERY],
        awaitRefetchQueries: true,
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
  useEffect(() => {
    if (!loading && data) {
      const lastPage = Math.max(1, Math.ceil(data.media.total / PER_PAGE));
      if (page > lastPage) setPage(lastPage);
    }
  }, [data, loading, page]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Perpustakaan media" description={appSlug} actions={canView && canCreate &&
        <Button className="min-h-11" type="button" ref={uploadTrigger}
          onClick={() => { setStatus(null); setDialogOpen(true); }}>Unggah media</Button>} />
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
              <TableToolbar onSubmit={handleApply}>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className={LABEL_CLASS}>Pencarian</span>
                  <Input
                    type="search"
                    placeholder="Cari nama berkas…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="min-h-11 bg-card"
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="min-h-11"
                  >
                    Cari
                  </Button>
                  <Button
                    type="button"
                    onClick={handleReset}
                    variant="outline"
                    className="min-h-11"
                  >
                    Atur ulang
                  </Button>
                </div>
              </TableToolbar>

              {status && (
                <p
                  role={status.kind === "sukses" ? "status" : "alert"}
                  className={
                    status.kind === "sukses"
                      ? "mt-4 text-sm text-green-700"
                      : "mt-4 text-sm text-red-700"
                  }
                >
                  {status.text}
                </p>
              )}

              {canCreate && (
                <UploadDialog
                  open={dialogOpen}
                  appSlug={appSlug}
                  finalFocus={() => uploadTrigger.current}
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

              {loading && <LoadingState />}
              {error && (
                <ErrorState onRetry={() => void refetch()}>{graphQLErrorMessage(error, "Gagal memuat media.")}</ErrorState>
              )}
              {data && total === 0 && applied.trim() === "" && (
                <EmptyState>
                  Belum ada media di aplikasi ini.
                </EmptyState>
              )}
              {data && total === 0 && applied.trim() !== "" && (
                <EmptyState>
                  Tidak ada media yang cocok dengan pencarian.
                </EmptyState>
              )}
              {data && total > 0 && (
                <>
                  <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {data.media.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
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
                  <div className="mt-4">
                    <Pagination pageIndex={page - 1} pageSize={PER_PAGE} totalRows={total}
                      onPageChange={(index) => setPage(index + 1)} />
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
