import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";

const tones = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-red-200 bg-red-50 text-red-900",
  info: "border-teal-200 bg-teal-50 text-teal-900",
} as const;

export type StatusTone = keyof typeof tones;

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }): JSX.Element {
  return <Badge variant="outline" className={tones[tone]}>{label}</Badge>;
}
