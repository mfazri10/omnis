"use client";

import { useQuery } from "@apollo/client/react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, JSX } from "react";
import {
  MEDIA_QUERY,
} from "../../features/media/graphql/media.graphql";
import type {
  MediaData,
  MediaFilter,
} from "../../features/media/graphql/media.graphql";
import { formatBytes } from "../../features/media/upload-client";
import { graphQLErrorMessage } from "../../features/rbac/graphql/errors";

const PER_PAGE = 12;

export interface MediaSelection {
  id: string;
  url: string;
  altText: string | null;
}

export interface MediaPickerProps {
  open: boolean;
  appSlug: string;
  onSelect: (selection: MediaSelection) => void;
  onClose: () => void;
}

/**
 * Pemilih media bersama (F09): modal galeri untuk form modul
 * (soal, produk, kampanye, config). Belum dipakai form mana pun,
 * tapi siap pakai: cukup render dengan `open` + `onSelect`.
 */
export function MediaPicker({
  open,
  appSlug,
  onSelect,
  onClose,
}: MediaPickerProps): JSX.Element | null {
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft("");
    setApplied("");
    setPage(1);
    searchRef.current?.focus();
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { data, loading, error, refetch } = useQuery(MEDIA_QUERY, {
    variables: {
      page,
      perPage: PER_PAGE,
      filter: (applied.trim() === ""
        ? null
        : { search: applied.trim() }) as MediaFilter | null,
    },
    skip: !open,
  });

  if (!open) {
    return null;
  }

  function handleApply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setApplied(draft);
  }

  function handleSelect(item: MediaData): void {
    onSelect({ id: item.id, url: item.url, altText: item.altText });
    onClose();
  }

  const total = data?.media.total ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-pemilih-media"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col border border-slate-200 bg-white p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="judul-pemilih-media"
            className="text-sm font-semibold text-slate-900"
          >
            {`Pilih media (${appSlug})`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pemilih media"
            className="min-h-[44px] min-w-[44px] border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            Tutup
          </button>
        </div>
        <form className="mt-3 flex gap-2" onSubmit={handleApply}>
          <input
            ref={searchRef}
            type="search"
            placeholder="Cari nama berkas…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Cari media"
            className="min-h-[44px] flex-1 border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
          <button
            type="submit"
            className="min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Cari
          </button>
        </form>
        <div className="mt-3 flex-1 overflow-y-auto">
          {loading && <p className="text-slate-900">Memuat…</p>}
          {error && (
            <div>
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
          {data && total === 0 && (
            <p className="text-sm text-slate-600">
              Belum ada media. Unggah dulu dari halaman Media.
            </p>
          )}
          {data && total > 0 && (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {data.media.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    title={item.fileName}
                    className="flex w-full flex-col border border-slate-200 text-left hover:border-slate-900"
                  >
                    {item.mimeType.startsWith("image/") ? (
                      <img
                        src={item.url}
                        alt={item.altText ?? item.fileName}
                        width={200}
                        height={200}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <span className="flex aspect-square w-full items-center justify-center bg-slate-100 text-sm font-bold text-slate-700">
                        PDF
                      </span>
                    )}
                    <span className="truncate p-2 text-xs text-slate-900">
                      {item.fileName}
                    </span>
                    <span className="px-2 pb-2 text-xs text-slate-600">
                      {formatBytes(item.sizeBytes)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {data && total > 0 && (
          <div className="mt-3 flex items-center gap-4 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-h-[44px] underline disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="text-slate-600">
              {`Halaman ${page} dari ${Math.max(1, Math.ceil(total / PER_PAGE))}`}
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
        )}
      </section>
    </div>
  );
}
