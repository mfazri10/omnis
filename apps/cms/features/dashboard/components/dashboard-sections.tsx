import type { JSX, ReactNode } from "react";
import { EmptyState } from "@/components/shared/page-state";
import { Card, CardContent } from "@/components/ui/card";
import { AppStatusBadge } from "@/features/apps/components/app-status-badge";
import { formatCount, formatDateTime } from "@/lib/format-display";
import type { AppCampaignSummaryData, DashboardActivityData, DashboardSectionData, NotificationQueueData, PlatformAppCardData } from "../graphql/dashboard.graphql";

export function DashboardSection({ id, title, children }: { id: string; title: string; children: ReactNode }): JSX.Element {
  return <section aria-labelledby={id} className="mt-7">
    <h2 id={id} className="mb-3 text-base font-semibold tracking-tight">{title}</h2>
    {children}
  </section>;
}

export function MetricCard({ label, value, hint }: { label: string; value: number | null; hint?: string | null }): JSX.Element {
  return (
    <Card className="min-w-0 py-3">
      <CardContent>
        <dt className="text-sm text-muted-foreground wrap-anywhere">{label}</dt>
        <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums wrap-anywhere">{formatCount(value)}</dd>
        {hint && <dd className="mt-1 text-xs text-muted-foreground wrap-anywhere">{hint}</dd>}
      </CardContent>
    </Card>
  );
}

function Metrics({ items }: { items: { label: string; value: number | null; hint?: string | null; key?: string }[] }): JSX.Element {
  return <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
    {items.map((item) => <MetricCard key={item.key ?? item.label} label={item.label} value={item.value} hint={item.hint} />)}
  </dl>;
}

export function QueueSummary({ queue }: { queue: NotificationQueueData }): JSX.Element {
  return <DashboardSection id="antrean-notifikasi" title="Antrean notifikasi">
    <Metrics items={[
      { label: "Terjadwal", value: queue.scheduled },
      { label: "Mengirim", value: queue.sending },
      { label: "Gagal", value: queue.failed },
    ]} />
  </DashboardSection>;
}

export function CampaignSummary({ campaigns }: { campaigns: AppCampaignSummaryData }): JSX.Element {
  return <DashboardSection id="kampanye" title="Kampanye notifikasi">
    <Metrics items={[
      { label: "Draf", value: campaigns.draft },
      { label: "Terjadwal", value: campaigns.scheduled },
      { label: "Terkirim", value: campaigns.sent },
      { label: "Gagal", value: campaigns.failed },
    ]} />
  </DashboardSection>;
}

export function ModuleMetricList({ sections }: { sections: DashboardSectionData[] }): JSX.Element {
  return <DashboardSection id="statistik-modul" title="Statistik modul">
    {sections.length ? <Metrics items={sections} /> : <EmptyState>Belum ada statistik modul.</EmptyState>}
  </DashboardSection>;
}

export function PlatformAppCard({ app }: { app: PlatformAppCardData }): JSX.Element {
  return <Card className="min-w-0 py-4">
    <CardContent>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 font-semibold wrap-anywhere">{app.name}</h3>
        <AppStatusBadge status={app.status} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground wrap-anywhere">{app.slug}</p>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-3 text-sm">
        <div><dt className="text-muted-foreground">Pengguna</dt><dd className="font-semibold tabular-nums">{formatCount(app.userCount)}</dd></div>
        <div><dt className="text-muted-foreground">Aktivitas 7 hari</dt><dd className="font-semibold tabular-nums">{formatCount(app.activityCount7d)}</dd></div>
      </dl>
    </CardContent>
  </Card>;
}

export function ActivityList({ items, emptyMessage }: { items: DashboardActivityData[]; emptyMessage: string }): JSX.Element {
  if (!items.length) return <EmptyState>{emptyMessage}</EmptyState>;
  return <ul className="divide-y divide-border rounded-lg border border-border bg-card">
    {items.map((item) => <li key={item.id} className="px-4 py-3 text-sm wrap-anywhere">
      <p>{item.summary}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {item.adminName ?? `Admin #${item.adminId}`} · {item.appName ?? "Global"} · {formatDateTime(item.createdAt)}
      </p>
    </li>)}
  </ul>;
}
