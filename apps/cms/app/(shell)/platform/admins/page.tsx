"use client";

import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { PermissionGate } from "../../../../features/rbac/components/permission-gate";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import { ADMINS_QUERY } from "../../../../features/rbac/graphql/admins.graphql";

const TAKE = 20;

export default function AdminsPage(): JSX.Element {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const { data, loading, error } = useQuery(ADMINS_QUERY, {
    variables: { search: search === "" ? null : search, skip, take: TAKE },
  });

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSkip(0);
    setSearch(draft);
  }

  const totalCount = data?.admins.totalCount ?? 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <PermissionGate requires="platform.admins.manage">
          <a className="text-sm underline" href="/platform/admins/new">
            Tambah admin
          </a>
        </PermissionGate>
      </div>
      <form className="mt-6 flex gap-2" onSubmit={handleSearch}>
        <input
          type="search"
          placeholder="Cari nama atau email…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
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
          {graphQLErrorMessage(error, "Gagal memuat daftar admin.")}
        </p>
      )}
      {data && (
        <>
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-semibold">Nama</th>
                <th className="py-2 pr-4 font-semibold">Email</th>
                <th className="py-2 pr-4 font-semibold">Peran</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.admins.items.map((admin) => (
                <tr key={admin.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-900">{admin.name}</td>
                  <td className="py-2 pr-4 text-slate-600">{admin.email}</td>
                  <td className="py-2 pr-4 text-slate-600">
                    {admin.isSuperAdmin ? "Super Admin" : "Admin"}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">
                    {admin.isActive ? "Aktif" : "Nonaktif"}
                  </td>
                  <td className="py-2">
                    <a
                      className="underline"
                      href={`/platform/admins/${admin.id}`}
                    >
                      Kelola
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <button
              type="button"
              disabled={skip === 0}
              onClick={() => setSkip((s) => Math.max(0, s - TAKE))}
              className="underline disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="text-slate-600">
              {totalCount === 0
                ? "0 dari 0"
                : `${skip + 1}–${Math.min(skip + TAKE, totalCount)} dari ${totalCount}`}
            </span>
            <button
              type="button"
              disabled={skip + TAKE >= totalCount}
              onClick={() => setSkip((s) => s + TAKE)}
              className="underline disabled:opacity-50"
            >
              Berikutnya
            </button>
          </div>
        </>
      )}
    </main>
  );
}
