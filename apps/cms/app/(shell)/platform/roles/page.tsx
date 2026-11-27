"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { useState } from "react";
import type { JSX } from "react";
import { ButtonLink } from "@/components/shared/button-link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PermissionGate } from "../../../../features/rbac/components/permission-gate";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import {
  DELETE_ROLE_MUTATION,
  ROLES_QUERY,
} from "../../../../features/rbac/graphql/roles.graphql";

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
      {actionError && (
        <ErrorState>{actionError}</ErrorState>
      )}
      {data && data.roles.length === 0 && (
        <EmptyState>Belum ada role.</EmptyState>
      )}
      {data && data.roles.length > 0 && (
        <div className="mt-4">
        <Table scrollLabel="Daftar role" className="min-w-max bg-card">
          <TableHeader className="bg-muted">
            <TableRow>
              {["Nama", "Cakupan", "Izin", "Aksi"].map((label) => <TableHead scope="col" key={label}>{label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="max-w-60 font-medium whitespace-normal wrap-anywhere">{role.name}</TableCell>
                <TableCell>{role.scopeType === "app" ? "Aplikasi" : "Global"}</TableCell>
                <TableCell>{role.permissionKeys.length}</TableCell>
                <TableCell>
                  <ButtonLink variant="link" href={`/platform/roles/${role.id}`}>Ubah</ButtonLink>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </main>
  );
}
