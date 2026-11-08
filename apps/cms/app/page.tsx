"use client";

import { useQuery } from "@apollo/client/react";
import type { JSX } from "react";
import { API_VERSION_QUERY } from "../features/meta/graphql/api-version.query";

export default function HomePage(): JSX.Element {
  const { data, loading, error } = useQuery(API_VERSION_QUERY);

  return (
    <main className="mx-auto max-w-xl px-6 py-16 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Fondasi berhasil berjalan
      </h1>

      <div className="mt-6 border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Status koneksi GraphQL
        </h2>
        {loading && <p className="mt-2 text-slate-900">Menghubungi API…</p>}
        {error && (
          <p className="mt-2 text-red-700">
            Koneksi gagal: {error.message}. Pastikan API berjalan di{" "}
            {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}.
          </p>
        )}
        {data && (
          <p className="mt-2 text-slate-900">
            Terhubung ke API versi {data.apiVersion}.
          </p>
        )}
      </div>

      <p className="mt-6 text-sm text-slate-600">
        Shell CMS (login, app switcher, menu) menyusul di F01–F02.
      </p>
    </main>
  );
}
