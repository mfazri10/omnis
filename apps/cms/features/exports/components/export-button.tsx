"use client";

import type { TypedDocumentNode } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { graphQLErrorMessage } from "../../rbac/graphql/errors";
import { EXPORT_JOB_QUERY } from "../graphql/exports.graphql";
import type {
  ExportJobData,
  ExportJobStatus,
} from "../graphql/exports.graphql";

const POLL_INTERVAL_MS = 2000;
const TERMINAL: ExportJobStatus[] = ["DONE", "FAILED", "EXPIRED"];

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function formatSize(bytes: number | null): string {
  if (bytes === null) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatExpiry(iso: string | null): string {
  if (!iso) {
    return "";
  }
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface ExportButtonProps<F> {
  requestMutation: TypedDocumentNode<
    Record<string, ExportJobData>,
    { filter?: F | null }
  >;
  filter: F | null;
  labelSumber: string;
}

/**
 * Tombol ekspor CSV generik: minta job dengan filter tampilan,
 * polling status tiap 2 detik, lalu tampilkan tautan unduh ber-auth.
 */
export function ExportButton<F>({
  requestMutation,
  filter,
  labelSumber,
}: ExportButtonProps<F>): JSX.Element {
  const [request, { loading: requesting }] = useMutation(requestMutation);
  const [jobId, setJobId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const {
    data,
    error: pollError,
    startPolling,
    stopPolling,
  } = useQuery(EXPORT_JOB_QUERY, {
    variables: { id: jobId ?? "" },
    skip: jobId === null,
    pollInterval: POLL_INTERVAL_MS,
  });

  const job: ExportJobData | undefined = data?.exportJob;

  useEffect(() => {
    if (!job) {
      return;
    }
    if (TERMINAL.includes(job.status)) {
      stopPolling();
    } else {
      startPolling(POLL_INTERVAL_MS);
    }
  }, [job, startPolling, stopPolling]);

  async function handleExport(): Promise<void> {
    setRequestError(null);
    try {
      const result = await request({ variables: { filter } });
      const created = result.data
        ? Object.values(result.data)[0]
        : undefined;
      if (!created) {
        setRequestError("Gagal memulai ekspor. Coba lagi.");
        return;
      }
      setJobId(created.id);
    } catch (err: unknown) {
      setRequestError(graphQLErrorMessage(err, "Gagal memulai ekspor."));
    }
  }

  function handleReset(): void {
    setJobId(null);
    setRequestError(null);
  }

  const busy = requesting || (job !== undefined && !TERMINAL.includes(job.status));

  if (job?.status === "DONE" && job.downloadPath) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`${API_URL}${job.downloadPath}`}
          className={cn(buttonVariants(), "min-h-11")}
        >
          Unduh CSV
        </a>
        <p className="text-xs text-slate-600">
          {job.fileName}
          {job.fileSizeBytes !== null && ` (${formatSize(job.fileSizeBytes)})`}
          {job.expiresAt && `, berlaku sampai ${formatExpiry(job.expiresAt)}`}
        </p>
        <Button
          type="button"
          onClick={handleReset}
          variant="link"
          className="min-h-11"
        >
          Buat ekspor baru
        </Button>
      </div>
    );
  }

  if (job?.status === "FAILED" || job?.status === "EXPIRED") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-destructive" role="alert">
          {job.status === "FAILED"
            ? (job.errorMessage ?? `Ekspor ${labelSumber} gagal. Coba lagi.`)
            : "Tautan unduh sudah kedaluwarsa. Buat ekspor baru."}
        </p>
        <Button
          type="button"
          onClick={handleReset}
          variant="outline"
          className="min-h-11"
        >
          Coba lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        disabled={busy}
        onClick={() => void handleExport()}
        aria-label={`Ekspor ${labelSumber} ke CSV`}
        variant="outline"
        className="min-h-11"
      >
        {requesting || job?.status === "QUEUED"
          ? "Menyiapkan ekspor…"
          : job?.status === "RUNNING"
            ? "Memproses ekspor…"
            : "Ekspor CSV"}
      </Button>
      {requestError && (
        <p className="text-sm text-destructive" role="alert">{requestError}</p>
      )}
      {pollError && jobId !== null && (
        <p className="text-sm text-destructive" role="alert">
          {graphQLErrorMessage(pollError, "Gagal memantau status ekspor.")}
        </p>
      )}
    </div>
  );
}
