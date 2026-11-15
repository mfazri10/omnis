"use client";

import { useQuery } from "@apollo/client/react";
import { EFFECTIVE_PERMISSIONS_QUERY } from "../graphql/admins.graphql";

export interface EffectivePermissions {
  keys: string[];
  loading: boolean;
}

export function useEffectivePermissions(
  adminId: string,
  appId?: string | null,
): EffectivePermissions {
  const { data, loading } = useQuery(EFFECTIVE_PERMISSIONS_QUERY, {
    variables: { adminId, appId: appId ?? null },
  });
  return { keys: data?.effectivePermissions ?? [], loading };
}
