"use client";

import { useQuery } from "@apollo/client/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { JSX, ReactNode } from "react";
import { CURRENT_ADMIN_QUERY } from "../../features/rbac/graphql/admins.graphql";
import {
  MY_APPS_QUERY,
  MY_PERMISSIONS_QUERY,
} from "../../features/shell/graphql/session.graphql";
import { ShellHeader } from "../../components/shared/shell-header";
import { CmsSidebar } from "@/components/shared/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ApolloProvider } from "@/lib/apollo-provider";
import { Toaster } from "@/components/shared/toaster";
import { ErrorState, LoadingState } from "@/components/shared/page-state";
import { CMS_PICKER_PATH } from "@/features/shell/routes";
import { useToastStore } from "../../stores/use-toast-store";
import { useSessionStore } from "../../stores/use-session-store";

function CmsSession({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const { appSlug: routeSlug } = useParams<{ appSlug?: string }>();
  const globalRoute = routeSlug === undefined;
  const setSession = useSessionStore((state) => state.setSession);
  const activeSlug = useSessionStore((state) => state.activeSlug);
  const setActiveSlug = useSessionStore((state) => state.setActiveSlug);
  const setPermissions = useSessionStore((state) => state.setPermissions);
  const setReady = useSessionStore((state) => state.setReady);
  const ready = useSessionStore((state) => state.ready);
  const permissionsContext = useSessionStore((state) => state.permissionsContext);
  const pushToast = useToastStore((state) => state.push);

  const adminQuery = useQuery(CURRENT_ADMIN_QUERY, {
    context: { appSlug: null },
  });
  const appsQuery = useQuery(MY_APPS_QUERY, {
    context: { appSlug: null },
  });

  useEffect(() => {
    if (adminQuery.data && appsQuery.data) {
      setSession(adminQuery.data.currentAdmin, appsQuery.data.myApps);
    }
  }, [adminQuery.data, appsQuery.data, setSession]);

  // Catatan: tanpa reset-on-unmount. Logout mereset eksplisit; sesi
  // habis me-reload penuh. Reset saat unmount menghapus activeSlug
  // persisten (StrictMode dev me-mount dua kali).

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
      if (routeSlug === activeSlug) router.replace(CMS_PICKER_PATH);
    }
  }, [appsQuery.data, activeSlug, routeSlug, setActiveSlug, pushToast, router]);

  const routeApp = appsQuery.data?.myApps.find((app) => app.slug === routeSlug);
  const activeRouteSlug = routeApp?.slug ?? null;
  const context = activeRouteSlug ?? "global";
  useEffect(() => {
    if (sessionLoaded && (globalRoute || routeApp)) setActiveSlug(activeRouteSlug);
  }, [sessionLoaded, globalRoute, routeApp, activeRouteSlug, setActiveSlug]);

  const permsQuery = useQuery(MY_PERMISSIONS_QUERY, {
    variables: { appId: routeApp?.id ?? null },
    context: { appSlug: routeApp?.slug ?? null },
    skip: !sessionLoaded,
  });

  useEffect(() => {
    if (permsQuery.data && !permsQuery.loading && sessionLoaded) {
      setPermissions(
        permsQuery.data.myPermissions,
        context,
      );
      setReady();
    }
  }, [permsQuery.data, permsQuery.loading, sessionLoaded, context, setPermissions, setReady]);

  const loadError =
    adminQuery.error ?? appsQuery.error ?? permsQuery.error;
  if (loadError) {
    return (
      <main className="mx-auto max-w-xl px-6 py-8 font-sans">
        <ErrorState title="Gagal memuat sesi" onRetry={() => window.location.reload()}>
          {loadError.message}
        </ErrorState>
      </main>
    );
  }
  if (!ready || !sessionLoaded) {
    return (
      <main className="mx-auto max-w-xl px-6 py-8 font-sans">
        <LoadingState>Menyiapkan sesi…</LoadingState>
      </main>
    );
  }
  return (
    <SidebarProvider>
      <a href="#cms-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:p-3">
        Lewati ke konten
      </a>
      <CmsSidebar />
      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        <ShellHeader />
        <div id="cms-content" tabIndex={-1} className="min-w-0 scroll-mt-20">
          {permsQuery.loading || permissionsContext !== context || (globalRoute && activeSlug !== null)
            ? <main className="px-4 py-6 sm:px-6"><LoadingState>Menyiapkan ruang kerja…</LoadingState></main>
            : children}
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function ShellLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ApolloProvider>
      <CmsSession>{children}</CmsSession>
      <Toaster />
    </ApolloProvider>
  );
}
