"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent, JSX } from "react";
import { authClient } from "../../../lib/auth-client";

function ResetForm(): JSX.Element {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!token) {
      setError("Tautan tidak valid.");
      return;
    }
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi tidak sama.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError("Tautan kedaluwarsa atau tidak valid. Minta tautan baru.");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-6 text-sm text-slate-900">
        Kata sandi berhasil diubah.{" "}
        <a className="underline" href="/login">
          Masuk di sini
        </a>
        .
      </p>
    );
  }

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-900">Kata sandi baru</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-slate-300 px-3 py-2 text-slate-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-900">Konfirmasi kata sandi</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="border border-slate-300 px-3 py-2 text-slate-900"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Menyimpan…" : "Simpan kata sandi"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage(): JSX.Element {
  return (
    <main className="mx-auto max-w-sm px-6 py-16 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Atur ulang kata sandi
      </h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </main>
  );
}
