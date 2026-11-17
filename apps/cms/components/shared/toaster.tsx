"use client";

import type { JSX } from "react";
import { useToastStore } from "../../stores/use-toast-store";

export function Toaster(): JSX.Element {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  if (toasts.length === 0) {
    return <></>;
  }
  return (
    <div className="fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start justify-between gap-2 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-lg"
        >
          <p>{toast.message}</p>
          <button
            type="button"
            aria-label="Tutup notifikasi"
            className="text-slate-500 underline"
            onClick={() => dismiss(toast.id)}
          >
            Tutup
          </button>
        </div>
      ))}
    </div>
  );
}
