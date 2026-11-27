"use client";

import { useEffect } from "react";
import type { JSX } from "react";
import { useToastStore } from "../../stores/use-toast-store";

export function Toaster(): JSX.Element {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }
    // Toast menutup sendiri agar tak menutupi aksi header selamanya.
    const timer = setTimeout(() => {
      const oldest = useToastStore.getState().toasts[0];
      if (oldest) {
        useToastStore.getState().dismiss(oldest.id);
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [toasts]);
  if (toasts.length === 0) {
    return <></>;
  }
  return (
    <div className="fixed inset-x-4 top-4 z-50 ml-auto flex max-w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-md"
        >
          <p role="status">{toast.message}</p>
          <button
            type="button"
            aria-label="Tutup notifikasi"
            className="min-h-11 shrink-0 text-primary underline underline-offset-4"
            onClick={() => dismiss(toast.id)}
          >
            Tutup
          </button>
        </div>
      ))}
    </div>
  );
}
