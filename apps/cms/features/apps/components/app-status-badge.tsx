import type { ComponentProps, JSX } from "react";
import { StatusBadge } from "@/components/shared/status-badge";

const states = new Map<string, ComponentProps<typeof StatusBadge>>([
  ["active", { label: "Aktif", tone: "success" }],
  ["suspended", { label: "Ditangguhkan", tone: "warning" }],
  ["archived", { label: "Diarsipkan", tone: "neutral" }],
  ["provisioning", { label: "Disiapkan", tone: "info" }],
  ["failed", { label: "Gagal", tone: "danger" }],
]);

export function AppStatusBadge({ status }: { status: string }): JSX.Element {
  const state = states.get(status);
  return <StatusBadge label={state?.label ?? status} tone={state?.tone} />;
}
