"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { useState } from "react";
import type { JSX } from "react";
import { PermissionGate } from "../../../../features/rbac/components/permission-gate";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import {
  DELETE_ROLE_MUTATION,
  ROLES_QUERY,
} from "../../../../features/rbac/graphql/roles.graphql";

export default function RolesPage(): JSX.Element {
  const { data, loading, error } = useQuery(ROLES_QUERY);
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
    <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Role</h1>
        <PermissionGate requires="platform.roles.manage">
          <a className="text-sm underline" href="/platform/roles/new">
            Tambah role
          </a>
        </PermissionGate>
      </div>
      {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
      {error && (
        <p className="mt-6 text-sm text-red-700">
          {graphQLErrorMessage(error, "Gagal memuat daftar role.")}
        </p>
      )}
      {actionError && (
        <p className="mt-4 text-sm text-red-700">{actionError}</p>
      )}
      {data && data.roles.length === 0 && (
        <p className="mt-6 text-sm text-slate-600">Belum ada role.</p>
      )}
      {data && data.roles.length > 0 && (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th className="py-2 pr-4 font-semibold">Nama</th>
              <th className="py-2 pr-4 font-semibold">Cakupan</th>
              <th className="py-2 pr-4 font-semibold">Permission</th>
              <th className="py-2 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.roles.map((role) => (
              <tr key={role.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-slate-900">{role.name}</td>
                <td className="py-2 pr-4 text-slate-600">{role.scopeType}</td>
                <td className="py-2 pr-4 text-slate-600">
                  {role.permissionKeys.length}
                </td>
                <td className="flex gap-3 py-2">
                  <a
                    className="underline"
                    href={`/platform/roles/${role.id}`}
                  >
                    Ubah
                  </a>
                  <PermissionGate requires="platform.roles.manage">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void handleDelete(role.id, role.name)}
                      className="underline disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  </PermissionGate>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
