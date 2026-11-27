"use client";

import type { JSX, ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "./page-state";
import { Pagination } from "./pagination";
import type { PaginationProps } from "./pagination";

export interface DataTableProps<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  label: string;
  emptyMessage: ReactNode;
  pagination?: PaginationProps;
}

export function DataTable<T>({ rows, columns, getRowId, label, emptyMessage, pagination }: DataTableProps<T>): JSX.Element {
  const table = useReactTable({
    data: rows,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: Boolean(pagination),
    rowCount: pagination?.totalRows,
    state: pagination ? { pagination: { pageIndex: pagination.pageIndex, pageSize: pagination.pageSize } } : {},
  });

  return (
    <div className="min-w-0 space-y-3">
      {rows.length === 0 ? <EmptyState>{emptyMessage}</EmptyState> : (
        <Table scrollLabel={label} className="min-w-max bg-card">
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} scope={header.colSpan > 1 ? "colgroup" : "col"} colSpan={header.colSpan} className="px-3">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
