"use client";

import { PageHeader } from "@/components/shared/page-header";

import { useMutation, useQuery } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import {
  APPS_QUERY,
  PERMISSIONS_QUERY,
} from "../../../../../features/rbac/graphql/permissions.graphql";
import { CREATE_ROLE_MUTATION } from "../../../../../features/rbac/graphql/roles.graphql";

type Scope = "global" | "app";

const inputClass = "min-h-11 max-w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

export default function NewRolePage(): JSX.Element {
  const router = useRouter();
  const { data: permData, loading: permLoading } = useQuery(PERMISSIONS_QUERY);
  const { data: appsData } = useQuery(APPS_QUERY);
  const [createRole, { loading: saving }] = useMutation(CREATE_ROLE_MUTATION);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<Scope>("global");
  const [appId, setAppId] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const permissions = permData?.permissions ?? [];
  const modules = [...new Set(permissions.map((p) => p.module))].sort();

  function toggle(key: string): void {
    setChecked((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function changeScope(next: Scope): void {
    setScope(next);
    if (next === "app") {
      const globalOnly = new Set(
        permissions.filter((p) => p.globalOnly).map((p) => p.key),
      );
      setChecked((prev) => prev.filter((k) => !globalOnly.has(k)));
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await createRole({
        variables: {
          input: {
            name,
            description: description === "" ? null : description,
            scopeType: scope,
            appId: scope === "app" ? appId : null,
            permissionKeys: checked,
          },
        },
      });
      router.push("/platform/roles");
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal membuat role."));
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader title="Tambah role" />
      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => void handleSubmit(e)}
      >
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
        <fieldset className="flex gap-6 text-sm">
          <legend className="text-slate-900">Cakupan</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="scope"
              checked={scope === "global"}
              onChange={() => changeScope("global")}
            />
            <span className="text-slate-900">Global</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="scope"
              checked={scope === "app"}
              onChange={() => changeScope("app")}
            />
            <span className="text-slate-900">Satu aplikasi</span>
          </label>
        </fieldset>
        {scope === "app" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-900">Aplikasi</span>
            <select
              required
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className={inputClass}
            >
              <option value="">Pilih aplikasi…</option>
              {(appsData?.apps ?? []).map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.slug})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="text-sm">
          <p className="text-slate-900">Permission</p>
          {permLoading && <p className="mt-2 text-slate-600">Memuat…</p>}
          {modules.map((module) => (
            <div key={module} className="mt-3">
              <p className="font-semibold text-slate-900">{module}</p>
              <div className="mt-1 flex flex-col gap-1">
                {permissions
                  .filter((p) => p.module === module)
                  .map((p) => {
                    const disabled = scope === "app" && p.globalOnly;
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
                          {p.globalOnly && (
                            <span className="text-slate-600"> (global)</span>
                          )}
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
        </div>
      </form>
    </main>
  );
}
