"use client";

import { useQuery } from "@apollo/client/react";
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MEDIA_QUERY } from "@/features/media/graphql/media.graphql";
import type { MediaData } from "@/features/media/graphql/media.graphql";
import { formatBytes } from "@/features/media/upload-client";
import { graphQLErrorMessage } from "@/features/rbac/graphql/errors";
import { useBoundedPage } from "@/hooks/use-bounded-page";
import { EmptyState, ErrorState, LoadingState } from "./page-state";
import { Pagination } from "./pagination";
import { TableToolbar } from "./table-toolbar";

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

export function MediaPicker({ open, appSlug, onSelect, onClose }: MediaPickerProps): JSX.Element {
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);
  const { data, loading, error, refetch } = useQuery(MEDIA_QUERY, {
    variables: { page, perPage: PER_PAGE, filter: applied ? { search: applied } : null },
    skip: !open,
  });
  const pageValid = useBoundedPage(page, setPage, PER_PAGE, open && !loading ? data?.media.total : undefined);

  useEffect(() => {
    if (!open) {
      setDraft("");
      setApplied("");
      setPage(1);
    }
  }, [open]);

  function handleSelect(item: MediaData): void {
    onSelect({ id: item.id, url: item.url, altText: item.altText });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent initialFocus={searchRef} showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pilih media</DialogTitle>
          <DialogDescription>Perpustakaan media untuk {appSlug}.</DialogDescription>
        </DialogHeader>
        <TableToolbar className="my-0" onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPage(1);
          setApplied(draft.trim());
        }}>
          <label className="min-w-0 flex-1 space-y-1 text-sm font-medium">
            <span>Cari media</span>
            <Input ref={searchRef} type="search" placeholder="Nama berkas" value={draft}
              onChange={(e) => setDraft(e.target.value)} className="min-h-11" />
          </label>
          <Button className="min-h-11" type="submit" variant="outline">Cari</Button>
        </TableToolbar>
        {(loading || !pageValid) && <LoadingState />}
        {error && <ErrorState onRetry={() => void refetch()}>{graphQLErrorMessage(error, "Gagal memuat media.")}</ErrorState>}
        {data && !loading && pageValid && !data.media.items.length && <EmptyState>
          {applied ? "Tidak ada media yang cocok dengan pencarian." : "Belum ada media. Unggah dulu dari halaman Media."}
        </EmptyState>}
        {data && !loading && pageValid && data.media.items.length > 0 && (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.media.items.map((item) => (
                <li key={item.id} className="min-w-0">
                  <button type="button" onClick={() => handleSelect(item)}
                    className="flex w-full flex-col overflow-hidden rounded-lg border border-border text-left hover:border-primary">
                    {item.mimeType.startsWith("image/") ? (
                      <img src={item.url} alt={item.altText ?? ""} width={200} height={200} loading="lazy"
                        className="aspect-square w-full object-cover" />
                    ) : <span className="grid aspect-square w-full place-items-center bg-muted font-semibold">PDF</span>}
                    <span className="block w-full truncate px-2 pt-2 text-xs font-medium" title={item.fileName}>{item.fileName}</span>
                    <span className="px-2 pb-2 text-xs text-muted-foreground">{formatBytes(item.sizeBytes)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination pageIndex={page - 1} pageSize={PER_PAGE} totalRows={data.media.total}
              onPageChange={(index) => setPage(index + 1)} />
          </>
        )}
        <Button type="button" variant="outline" className="min-h-11 self-start" onClick={onClose}>Tutup</Button>
      </DialogContent>
    </Dialog>
  );
}
