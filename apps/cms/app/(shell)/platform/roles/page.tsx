"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { useState } from "react";
import type { JSX } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ButtonLink } from "@/components/shared/button-link";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/features/rbac/components/permission-gate";
import { graphQLErrorMessage } from "@/features/rbac/graphql/errors";
import type { RoleData } from "@/features/rbac/graphql/roles.graphql";
import {
  DELETE_ROLE_MUTATION,
  ROLES_QUERY,
} from "@/features/rbac/graphql/roles.graphql";

export default function RolesPage(): JSX.Element {
  const { data, loading, error, refetch } = useQuery(ROLES_QUERY);
  const [deleteRole, { loading: deleting }] = useMutation(DELETE_ROLE_MUTATION);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete(id: string, name: string): Promise<void> {
    if (!window.confirm(`Hapus role "${name}"?`)) {
      return;
    }
    setActionError(null);
    try {
      await deleteRole({
        variables: { id },
        refetchQueries: [{ query: ROLES_QUERY }],
      });
    } catch (err: unknown) {
      setActionError(graphQLErrorMessage(err, "Gagal menghapus role."));
    }
  }

  const columns: ColumnDef<RoleData>[] = [
    {
      id: "name",
      header: "Nama",
      cell: ({ row: { original: role } }) => (
        <span className="block max-w-60 whitespace-normal font-medium wrap-anywhere">
          {role.name}
        </span>
      ),
    },
    {
      id: "scope",
      header: "Cakupan",
      cell: ({ row: { original: role } }) =>
        role.scopeType === "app" ? "Aplikasi" : "Global",
    },
    {
      id: "permissions",
      header: "Izin",
      cell: ({ row: { original: role } }) => (
        <span className="tabular-nums">{role.permissionKeys.length}</span>
      ),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row: { original: role } }) => (
        <div className="flex items-center gap-2">
          <ButtonLink variant="link" href={`/platform/roles/${role.id}`}>
            Ubah
          </ButtonLink>
          <PermissionGate requires="platform.roles.manage">
            <Button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete(role.id, role.name)}
              variant="destructive"
              className="min-h-11"
            >
              Hapus
            </Button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Role" description="Atur peran serta izin di platform dan aplikasi." actions={
        <PermissionGate requires="platform.roles.manage">
          <ButtonLink href="/platform/roles/new">Tambah role</ButtonLink>
        </PermissionGate>
      } />
      {loading && <LoadingState />}
      {error && (
        <ErrorState onRetry={() => void refetch()}>
          {graphQLErrorMessage(error, "Gagal memuat daftar role.")}
        </ErrorState>
      )}
      {actionError && <ErrorState>{actionError}</ErrorState>}
      {data && (
        <div className="mt-4">
          <DataTable
            rows={data.roles}
            columns={columns}
            getRowId={(role) => role.id}
            label="Daftar role"
            emptyMessage="Belum ada role."
          />
        </div>
      )}
    </main>
  );
}
