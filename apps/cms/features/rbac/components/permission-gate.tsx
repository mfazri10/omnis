"use client";

import { useQuery } from "@apollo/client/react";
import type { JSX, ReactNode } from "react";
import {
  CURRENT_ADMIN_QUERY,
  EFFECTIVE_PERMISSIONS_QUERY,
} from "../graphql/admins.graphql";

interface PermissionGateProps {
  requires: string;
  fallback?: ReactNode;
  children: ReactNode;
}

// NOTE(F02): otorisasi terpusat pindah ke session store shell;
// gate per-halaman ini cukup untuk F05.
export function PermissionGate({
  requires,
  fallback = null,
  children,
}: PermissionGateProps): JSX.Element | null {
  const { data: adminData, loading: adminLoading } =
    useQuery(CURRENT_ADMIN_QUERY);
  const adminId = adminData?.currentAdmin.id;
  const { data: permsData, loading: permsLoading } = useQuery(
    EFFECTIVE_PERMISSIONS_QUERY,
    {
      variables: { adminId: adminId ?? "", appId: null },
      skip: adminId === undefined,
    },
  );
  if (adminLoading || permsLoading) {
    return null;
  }
  const admin = adminData?.currentAdmin;
  if (!admin) {
    return <>{fallback}</>;
  }
  if (admin.isSuperAdmin) {
    return <>{children}</>;
  }
  const keys = permsData?.effectivePermissions ?? [];
  return keys.includes(requires) ? <>{children}</> : <>{fallback}</>;
}
