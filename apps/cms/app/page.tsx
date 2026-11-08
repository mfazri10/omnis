"use client";

import { useQuery } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { API_VERSION_QUERY } from "../features/meta/graphql/api-version.query";
import { authClient, useSession } from "../lib/auth-client";

function TopBar(): JSX.Element {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  async function handleLogout(): Promise<void> {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 pb-4">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      {isPending ? (
        <p className="text-sm text-slate-600">Memuat sesi…</p>
      ) : (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-900">{session?.user.email}</span>
          <a className="underline" href="/profile/change-password">
            Ubah kata sandi
          </a>
          <button
            type="button"
            className="underline"
            onClick={() => void handleLogout()}
          >
            Keluar
          </button>
        </div>
      )}
    </header>
  );
}

export default function HomePage(): JSX.Element {
  const { data, loading, error } = useQuery(API_VERSION_QUERY);

  return (
    <main className="mx-auto max-w-xl px-6 py-8 font-sans">
      <TopBar />
      <h1 className="mt-8 text-2xl font-bold text-slate-900">
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
        Shell CMS (app switcher, menu) menyusul di F02.
      </p>
    </main>
  );
}
