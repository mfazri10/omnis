"use client";

import type { JSX, ReactNode } from "react";
import { useSessionStore } from "../../../stores/use-session-store";

interface PermissionGateProps {
  requires: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/** Gerbang otorisasi UI dari store sesi (menu + gate satu sumber). */
export function PermissionGate({
  requires,
  fallback = null,
  children,
}: PermissionGateProps): JSX.Element | null {
  const ready = useSessionStore((state) => state.ready);
  const admin = useSessionStore((state) => state.admin);
  const permissions = useSessionStore((state) => state.permissions);
  if (!ready || !admin) {
    return null;
  }
  if (admin.isSuperAdmin) {
    return <>{children}</>;
  }
  return permissions.includes(requires) ? <>{children}</> : <>{fallback}</>;
}
