"use client";

import { useQuery } from "@apollo/client/react";
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ButtonLink } from "@/components/shared/button-link";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/page-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionGate } from "@/features/rbac/components/permission-gate";
import { graphQLErrorMessage } from "@/features/rbac/graphql/errors";
import { ADMINS_QUERY } from "@/features/rbac/graphql/admins.graphql";
import type { AdminData } from "@/features/rbac/graphql/admins.graphql";

const PAGE_SIZE = 20;
const columns: ColumnDef<AdminData>[] = [
  { accessorKey: "name", header: "Nama" },
  { accessorKey: "email", header: "Email" },
  { id: "role", header: "Peran", cell: ({ row }) => row.original.isSuperAdmin ? "Super Admin" : "Admin" },
  { id: "status", header: "Status", cell: ({ row }) => <StatusBadge
    label={row.original.isActive ? "Aktif" : "Nonaktif"} tone={row.original.isActive ? "success" : "neutral"} /> },
  { id: "action", header: "Aksi", cell: ({ row }) =>
    <ButtonLink variant="link" href={`/platform/admins/${row.original.id}`}>Kelola</ButtonLink> },
];

export default function AdminsPage(): JSX.Element {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const { data, loading, error, refetch } = useQuery(ADMINS_QUERY, {
    variables: { search: search || null, skip: pageIndex * PAGE_SIZE, take: PAGE_SIZE },
  });
  const result = data?.admins;
  const validPage = result ? Math.min(pageIndex, Math.max(0, Math.ceil(result.totalCount / PAGE_SIZE) - 1)) : pageIndex;

  useEffect(() => {
    if (!loading && validPage !== pageIndex) setPageIndex(validPage);
  }, [loading, pageIndex, validPage]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Admin" description="Kelola akun yang dapat masuk ke CMS." actions={
        <PermissionGate requires="platform.admins.manage">
          <ButtonLink href="/platform/admins/new">Tambah admin</ButtonLink>
        </PermissionGate>
      } />
      <TableToolbar onSubmit={(event) => {
        event.preventDefault();
        setSearch(draft.trim());
        setPageIndex(0);
      }}>
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="admin-search" className="mb-1 block text-sm font-medium">Cari admin</label>
          <Input id="admin-search" type="search" placeholder="Nama atau email" value={draft}
            onChange={(event) => setDraft(event.target.value)} className="min-h-11 bg-card" />
        </div>
        <Button type="submit" variant="outline" className="min-h-11">Cari</Button>
      </TableToolbar>
      {(loading || validPage !== pageIndex) && <LoadingState />}
      {error && <ErrorState onRetry={() => void refetch()}>{graphQLErrorMessage(error, "Gagal memuat daftar admin.")}</ErrorState>}
      {result && pageIndex === validPage && !loading && !error && <DataTable
        rows={result.items} columns={columns} getRowId={(row) => row.id} label="Daftar admin"
        emptyMessage={search ? "Tidak ada admin yang cocok dengan pencarian." : "Belum ada akun admin."}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, totalRows: result.totalCount, onPageChange: setPageIndex }}
      />}
    </main>
  );
}
