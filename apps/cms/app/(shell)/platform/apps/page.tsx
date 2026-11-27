"use client";

import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import type { JSX } from "react";
import { ButtonLink } from "@/components/shared/button-link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-state";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppStatusBadge } from "@/features/apps/components/app-status-badge";
import { APPS_LIST_QUERY } from "@/features/apps/graphql/apps.graphql";
import { PermissionGate } from "@/features/rbac/components/permission-gate";
import { graphQLErrorMessage } from "@/features/rbac/graphql/errors";

const statuses = [
  ["all", "Semua status"],
  ["active", "Aktif"],
  ["suspended", "Ditangguhkan"],
  ["archived", "Diarsipkan"],
  ["provisioning", "Disiapkan"],
  ["failed", "Gagal"],
];
const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function AppsPage(): JSX.Element {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data, loading, error, refetch } = useQuery(APPS_LIST_QUERY, {
    variables: { status, search: search || null },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Aplikasi" description="Lihat status dan buka pengaturan tiap aplikasi." actions={
        <PermissionGate requires="platform.apps.manage">
          <ButtonLink href="/platform/apps/new">Tambah aplikasi</ButtonLink>
        </PermissionGate>
      } />
      <TableToolbar onSubmit={(event) => {
        event.preventDefault();
        setSearch(draft.trim());
      }}>
        <div className="w-full min-w-0 sm:max-w-xs">
          <label htmlFor="app-search" className="mb-1 block text-sm font-medium">Cari aplikasi</label>
          <Input id="app-search" type="search" placeholder="Nama atau slug" value={draft}
            onChange={(event) => setDraft(event.target.value)} className="min-h-11 bg-card" />
        </div>
        <div>
          <label htmlFor="app-status" className="mb-1 block text-sm font-medium">Status</label>
          <select id="app-status" value={status} onChange={(event) => setStatus(event.target.value)}
            className="min-h-11 rounded-lg border border-input bg-card px-2 text-sm">
            {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <Button type="submit" variant="outline" className="min-h-11">Cari</Button>
      </TableToolbar>
      {loading && <LoadingState />}
      {error && <ErrorState onRetry={() => void refetch()}>{graphQLErrorMessage(error, "Gagal memuat daftar aplikasi.")}</ErrorState>}
      {data?.apps.length === 0 && <EmptyState>
        {search || status !== "all" ? "Tidak ada aplikasi yang cocok dengan filter." : "Belum ada aplikasi."}
      </EmptyState>}
      {data && data.apps.length > 0 && (
        <Table scrollLabel="Daftar aplikasi" className="min-w-max bg-card">
          <TableHeader className="bg-muted"><TableRow>
            {["Nama", "Slug", "Status", "Dibuat", "Aksi"].map((title) => <TableHead key={title} scope="col" className="px-3">{title}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {data.apps.map((app) => <TableRow key={app.id}>
              <TableCell className="max-w-72 px-3 font-medium whitespace-normal wrap-anywhere">{app.name}</TableCell>
              <TableCell className="px-3 text-muted-foreground">{app.slug}</TableCell>
              <TableCell className="px-3"><AppStatusBadge status={app.status} /></TableCell>
              <TableCell className="px-3">{date.format(new Date(app.createdAt))}</TableCell>
              <TableCell className="px-3"><ButtonLink href={`/platform/apps/${app.slug}`} variant="link">Kelola</ButtonLink></TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
