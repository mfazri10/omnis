"use client";

import { useEffect } from "react";
import type { JSX, ReactNode } from "react";
import { useSessionStore } from "../../../stores/use-session-store";

/** Rute global: kosongkan konteks aplikasi saat masuk area platform. */
export default function PlatformLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const setActiveSlug = useSessionStore((state) => state.setActiveSlug);
  useEffect(() => {
    setActiveSlug(null);
  }, [setActiveSlug]);
  return <>{children}</>;
}
