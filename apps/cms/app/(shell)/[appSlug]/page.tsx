"use client";

import { useQuery } from "@apollo/client/react";
import { use } from "react";
import type { JSX } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/page-state";
import { AppStatusBadge } from "@/features/apps/components/app-status-badge";
import { ActivityList, CampaignSummary, DashboardSection, ModuleMetricList } from "@/features/dashboard/components/dashboard-sections";
import { APP_DASHBOARD_QUERY } from "@/features/dashboard/graphql/dashboard.graphql";
import { graphQLErrorMessage } from "@/features/rbac/graphql/errors";
import { useSessionStore } from "@/stores/use-session-store";

export default function AppDashboardPage({ params }: { params: Promise<{ appSlug: string }> }): JSX.Element {
  const { appSlug } = use(params);
  const app = useSessionStore((state) => state.accessibleApps.find((item) => item.slug === appSlug));
  const { data, loading, error, refetch } = useQuery(APP_DASHBOARD_QUERY, {
    skip: app === undefined,
  });
  const dashboard = data?.appDashboard;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {app && <PageHeader title={dashboard?.app.name ?? app.name} description={app.slug}
        actions={<AppStatusBadge status={dashboard?.app.status ?? app.status} />} />}
      {(!app || loading) && <LoadingState>Memuat dasbor…</LoadingState>}
      {error && <ErrorState onRetry={() => void refetch()}>
        {graphQLErrorMessage(error, "Gagal memuat dasbor aplikasi.")}
      </ErrorState>}
      {dashboard && (
        <>
          <ModuleMetricList sections={dashboard.sections} />
          <CampaignSummary campaigns={dashboard.campaigns} />
          <DashboardSection id="aktivitas-terbaru" title="Aktivitas terakhir">
            <ActivityList items={dashboard.recentActivity} emptyMessage="Belum ada aktivitas tercatat untuk aplikasi ini." />
          </DashboardSection>
        </>
      )}
    </main>
  );
}
