import type { JSX } from "react";
import { Button } from "@/components/ui/button";

export interface PaginationProps {
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (pageIndex: number) => void;
}

export function Pagination({ pageIndex, pageSize, totalRows, onPageChange }: PaginationProps): JSX.Element | null {
  if (totalRows === 0) return null;
  const lastPage = Math.ceil(totalRows / pageSize) - 1;
  return (
    <nav aria-label="Halaman hasil" className="flex flex-wrap items-center gap-2 text-sm">
      <Button variant="outline" type="button" className="min-h-11" disabled={pageIndex <= 0}
        onClick={() => onPageChange(pageIndex - 1)}>Sebelumnya</Button>
      <span className="px-1 text-muted-foreground tabular-nums" aria-live="polite">
        {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalRows)} dari {totalRows}
      </span>
      <Button variant="outline" type="button" className="min-h-11" disabled={pageIndex >= lastPage}
        onClick={() => onPageChange(pageIndex + 1)}>Berikutnya</Button>
    </nav>
  );
}
