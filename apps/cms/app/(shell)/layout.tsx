"use client";

import { useQuery } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { JSX, ReactNode } from "react";
import { CURRENT_ADMIN_QUERY } from "../../features/rbac/graphql/admins.graphql";
import {
  MY_APPS_QUERY,
  MY_PERMISSIONS_QUERY,
} from "../../features/shell/graphql/session.graphql";
import { ShellHeader } from "../../components/shared/shell-header";
import { Sidebar } from "../../components/shared/sidebar";
import { useToastStore } from "../../stores/use-toast-store";
import { useSessionStore } from "../../stores/use-session-store";

export default function ShellLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const activeSlug = useSessionStore((state) => state.activeSlug);
  const setActiveSlug = useSessionStore((state) => state.setActiveSlug);
  const setPermissions = useSessionStore((state) => state.setPermissions);
  const setReady = useSessionStore((state) => state.setReady);
  const ready = useSessionStore((state) => state.ready);
  const reset = useSessionStore((state) => state.reset);
  const pushToast = useToastStore((state) => state.push);

  const adminQuery = useQuery(CURRENT_ADMIN_QUERY);
  const appsQuery = useQuery(MY_APPS_QUERY);

  useEffect(() => {
    if (adminQuery.data && appsQuery.data) {
      setSession(adminQuery.data.currentAdmin, appsQuery.data.myApps);
    }
  }, [adminQuery.data, appsQuery.data, setSession]);

  useEffect(() => reset, [reset]);

  const sessionLoaded =
    adminQuery.data !== undefined && appsQuery.data !== undefined;

  useEffect(() => {
    if (!appsQuery.data || activeSlug === null) {
      return;
    }
    const known = appsQuery.data.myApps.some(
      (app) => app.slug === activeSlug,
    );
    if (!known) {
      setActiveSlug(null);
      pushToast("Aplikasi tidak lagi tersedia. Silakan pilih aplikasi.");
      router.replace("/");
    }
  }, [appsQuery.data, activeSlug, setActiveSlug, pushToast, router]);

  const activeAppId =
    appsQuery.data?.myApps.find((app) => app.slug === activeSlug)?.id ??
    null;
  const permsQuery = useQuery(MY_PERMISSIONS_QUERY, {
    variables: { appId: activeAppId },
    skip: !sessionLoaded,
  });

  useEffect(() => {
    if (permsQuery.data && sessionLoaded) {
      setPermissions(
        permsQuery.data.myPermissions,
        activeSlug ?? "global",
      );
      setReady();
    }
  }, [permsQuery.data, sessionLoaded, activeSlug, setPermissions, setReady]);

  const loadError =
    adminQuery.error ?? appsQuery.error ?? permsQuery.error;
  if (loadError) {
    return (
      <main className="mx-auto max-w-xl px-6 py-8 font-sans">
        <h1 className="text-2xl font-bold text-slate-900">
          Gagal memuat sesi
        </h1>
        <p className="mt-2 text-sm text-slate-600">{loadError.message}</p>
        <button
          type="button"
          className="mt-4 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => window.location.reload()}
        >
          Muat ulang
        </button>
      </main>
    );
  }
  if (!ready) {
    return (
      <main className="mx-auto max-w-xl px-6 py-8 font-sans">
        <p className="text-slate-900">Menyiapkan sesi…</p>
      </main>
    );
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 font-sans md:px-6">
      <ShellHeader />
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:gap-8">
        <aside className="w-full md:w-56 md:shrink-0">
          <Sidebar />
        </aside>
        <div className="min-w-0 flex-1 overflow-x-auto">{children}</div>
      </div>
    </div>
  );
}
