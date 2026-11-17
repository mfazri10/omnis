import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminData } from "../features/rbac/graphql/admins.graphql";
import type { AccessibleAppData } from "../features/shell/graphql/session.graphql";

/** Nilai permissionsContext untuk konteks global (di luar aplikasi). */
export const GLOBAL_CONTEXT = "global";

export interface SessionState {
  admin: AdminData | null;
  accessibleApps: AccessibleAppData[];
  activeSlug: string | null;
  permissions: string[];
  /** Slug aplikasi pemilik permissions, atau GLOBAL_CONTEXT. */
  permissionsContext: string;
  ready: boolean;
  setSession: (
    admin: AdminData,
    accessibleApps: AccessibleAppData[],
  ) => void;
  setActiveSlug: (slug: string | null) => void;
  setPermissions: (keys: string[], context: string) => void;
  setReady: () => void;
  reset: () => void;
}

const initial: Pick<
  SessionState,
  | "admin"
  | "accessibleApps"
  | "activeSlug"
  | "permissions"
  | "permissionsContext"
  | "ready"
> = {
  admin: null,
  accessibleApps: [],
  activeSlug: null,
  permissions: [],
  permissionsContext: "global",
  ready: false,
};

/**
 * Sesi CMS: admin login + aplikasi terjangkau + slug aktif + permission
 * konteks aktif. Hanya activeSlug yang persisten (pilihan switcher
 * tersimpan antar sesi); sisanya diisi ulang tiap mount shell.
 */
export const useSessionStore = create<SessionState>()(
  persist<SessionState, [], [], Pick<SessionState, "activeSlug">>(
    (set) => ({
      ...initial,
      setSession: (admin, accessibleApps) =>
        set({ admin, accessibleApps }),
      setActiveSlug: (activeSlug) => set({ activeSlug }),
      setPermissions: (permissions, permissionsContext) =>
        set({ permissions, permissionsContext }),
      setReady: () => set({ ready: true }),
      reset: () => set({ ...initial }),
    }),
    {
      name: "cms-session",
      partialize: (state) => ({ activeSlug: state.activeSlug }),
    },
  ),
);
