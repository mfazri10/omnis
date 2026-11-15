"use client";

import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { PermissionGate } from "../../../features/rbac/components/permission-gate";
import { graphQLErrorMessage } from "../../../features/rbac/graphql/errors";
import { APPS_LIST_QUERY } from "../../../features/apps/graphql/apps.graphql";

const STATUSES = ["all", "active", "suspended", "archived", "provisioning", "failed"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AppsPage(): JSX.Element {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data, loading, error } = useQuery(APPS_LIST_QUERY, {
    variables: {
      status,
      search: search === "" ? null : search,
    },
  });

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSearch(draft);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Aplikasi</h1>
        <PermissionGate requires="platform.apps.manage">
          <a className="text-sm underline" href="/platform/apps/new">
            Tambah aplikasi
          </a>
        </PermissionGate>
      </div>
      <form className="mt-6 flex gap-2" onSubmit={handleSearch}>
        <input
          type="search"
          placeholder="Cari nama atau slug…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-slate-300 px-3 py-2 text-sm text-slate-900"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "Semua status" : s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Cari
        </button>
      </form>
      {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
      {error && (
        <p className="mt-6 text-sm text-red-700">
          {graphQLErrorMessage(error, "Gagal memuat daftar aplikasi.")}
        </p>
      )}
      {data && data.apps.length === 0 && (
        <p className="mt-6 text-sm text-slate-600">Belum ada aplikasi.</p>
      )}
      {data && data.apps.length > 0 && (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th className="py-2 pr-4 font-semibold">Nama</th>
              <th className="py-2 pr-4 font-semibold">Slug</th>
              <th className="py-2 pr-4 font-semibold">Status</th>
              <th className="py-2 pr-4 font-semibold">Dibuat</th>
              <th className="py-2 font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.apps.map((app) => (
              <tr key={app.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-slate-900">{app.name}</td>
                <td className="py-2 pr-4 text-slate-600">{app.slug}</td>
                <td className="py-2 pr-4 text-slate-600">{app.status}</td>
                <td className="py-2 pr-4 text-slate-600">
                  {formatDate(app.createdAt)}
                </td>
                <td className="py-2">
                  <a className="underline" href={`/platform/apps/${app.slug}`}>
                    Kelola
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
