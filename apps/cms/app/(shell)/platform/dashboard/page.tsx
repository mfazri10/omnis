"use client";

import { useQuery } from "@apollo/client/react";
import type { JSX } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-state";
import { ActivityList, DashboardSection, PlatformAppCard, QueueSummary } from "@/features/dashboard/components/dashboard-sections";
import { PLATFORM_DASHBOARD_QUERY } from "@/features/dashboard/graphql/dashboard.graphql";
import { graphQLErrorMessage } from "@/features/rbac/graphql/errors";
import { useSessionStore } from "@/stores/use-session-store";

export default function PlatformDashboardPage(): JSX.Element {
  const canView = useSessionStore((state) =>
    state.admin?.isSuperAdmin === true || state.permissions.includes("platform.apps.view"),
  );
  const { data, loading, error, refetch } = useQuery(PLATFORM_DASHBOARD_QUERY, { skip: !canView });
  const dashboard = data?.platformDashboard;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Dasbor Platform" description="Aplikasi, antrean notifikasi, dan aktivitas terbaru." />
      {!canView && <EmptyState>Anda tidak memiliki izin untuk melihat dasbor platform.</EmptyState>}
      {canView && loading && <LoadingState>Memuat dasbor…</LoadingState>}
      {canView && error && <ErrorState onRetry={() => void refetch()}>
        {graphQLErrorMessage(error, "Gagal memuat dasbor platform.")}
      </ErrorState>}
      {canView && dashboard && (
        <>
          <QueueSummary queue={dashboard.notificationQueue} />
          <DashboardSection id="daftar-aplikasi" title="Aplikasi">
            {dashboard.apps.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {dashboard.apps.map((app) => <PlatformAppCard key={app.id} app={app} />)}
              </div>
            ) : <EmptyState>Belum ada aplikasi terdaftar.</EmptyState>}
          </DashboardSection>
          <DashboardSection id="aktivitas-terbaru" title="Aktivitas terbaru">
            <ActivityList items={dashboard.recentActivity} emptyMessage="Belum ada aktivitas tercatat." />
          </DashboardSection>
        </>
      )}
    </main>
  );
}
