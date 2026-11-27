"use client";

import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useSessionStore } from "../../stores/use-session-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CMS_PICKER_PATH } from "@/features/shell/routes";

const EVERY_APP = "__all";

export function AppSwitcher(): JSX.Element {
  const router = useRouter();
  const apps = useSessionStore((state) => state.accessibleApps);
  const activeSlug = useSessionStore((state) => state.activeSlug);
  const setActiveSlug = useSessionStore((state) => state.setActiveSlug);
  if (apps.length === 0) {
    return <p className="text-sm text-muted-foreground">Tanpa aplikasi</p>;
  }
  return (
    <Select value={activeSlug ?? EVERY_APP} onValueChange={(value) => {
      if (value === null) return;
      const slug = value === EVERY_APP ? null : value;
      setActiveSlug(slug);
      router.push(slug === null ? CMS_PICKER_PATH : `/${slug}`);
    }}>
      <SelectTrigger aria-label="Pilih aplikasi" className="min-h-11 max-w-52 bg-card">
        <SelectValue>{apps.find((app) => app.slug === activeSlug)?.name ?? "Semua aplikasi"}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        <SelectItem value={EVERY_APP} className="min-h-11">Semua aplikasi</SelectItem>
        {apps.map((app) => (
          <SelectItem key={app.id} value={app.slug} className="min-h-11 wrap-anywhere">{app.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
