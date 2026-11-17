"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import { PERMISSIONS_QUERY } from "../../../../../features/rbac/graphql/permissions.graphql";
import type { RoleData } from "../../../../../features/rbac/graphql/roles.graphql";
import {
  DELETE_ROLE_MUTATION,
  ROLES_QUERY,
  UPDATE_ROLE_MUTATION,
} from "../../../../../features/rbac/graphql/roles.graphql";

const inputClass = "border border-slate-300 px-3 py-2 text-slate-900";

function RoleForm({ role }: { role: RoleData }): JSX.Element {
  const router = useRouter();
  const { data: permData } = useQuery(PERMISSIONS_QUERY);
  const [updateRole, { loading: saving }] = useMutation(UPDATE_ROLE_MUTATION);
  const [deleteRole, { loading: deleting }] = useMutation(DELETE_ROLE_MUTATION);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [checked, setChecked] = useState<string[]>(role.permissionKeys);
  const [error, setError] = useState<string | null>(null);

  const permissions = permData?.permissions ?? [];
  const modules = [...new Set(permissions.map((p) => p.module))].sort();

  function toggle(key: string): void {
    setChecked((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await updateRole({
        variables: {
          id: role.id,
          input: {
            name,
            description: description === "" ? null : description,
            permissionKeys: checked,
          },
        },
      });
      router.push("/platform/roles");
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal menyimpan role."));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!window.confirm(`Hapus role "${role.name}"?`)) {
      return;
    }
    setError(null);
    try {
      await deleteRole({ variables: { id: role.id } });
      router.push("/platform/roles");
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal menghapus role."));
    }
  }

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <p className="text-sm text-slate-600">
        Cakupan: {role.scopeType}
        {role.appId ? ` (app ${role.appId})` : ""}. Cakupan tak bisa diubah.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-900">Nama</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-900">Deskripsi (opsional)</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="text-sm">
        <p className="text-slate-900">Permission</p>
        {modules.map((module) => (
          <div key={module} className="mt-3">
            <p className="font-semibold text-slate-900">{module}</p>
            <div className="mt-1 flex flex-col gap-1">
              {permissions
                .filter((p) => p.module === module)
                .map((p) => {
                  const disabled = role.scopeType === "app" && p.globalOnly;
                  return (
                    <label
                      key={p.key}
                      className="flex items-center gap-2 text-slate-900"
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={checked.includes(p.key)}
                        onChange={() => toggle(p.key)}
                      />
                      <span>
                        {p.label}
                        <span className="text-slate-600"> ({p.key})</span>
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
        <a className="px-4 py-2 text-sm underline" href="/platform/roles">
          Batal
        </a>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void handleDelete()}
          className="px-4 py-2 text-sm text-red-700 underline disabled:opacity-50"
        >
          Hapus role
        </button>
      </div>
    </form>
  );
}

export default function RoleDetailPage(): JSX.Element {
  const params = useParams();
  const raw = params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  const { data, loading, error } = useQuery(ROLES_QUERY);
  const role = data?.roles.find((r) => r.id === id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Ubah role</h1>
      {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
      {error && (
        <p className="mt-6 text-sm text-red-700">
          {graphQLErrorMessage(error, "Gagal memuat role.")}
        </p>
      )}
      {data && !role && (
        <p className="mt-6 text-sm text-red-700">Role tidak ditemukan.</p>
      )}
      {role && <RoleForm key={role.id} role={role} />}
    </main>
  );
}
