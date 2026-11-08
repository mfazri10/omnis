"use client";

import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { authClient } from "../../../lib/auth-client";

export default function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      await authClient.requestPasswordReset({ email });
      // Pesan generik: jangan bocorkan apakah email terdaftar.
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Lupa kata sandi
      </h1>
      {done ? (
        <p className="mt-6 text-sm text-slate-900">
          Jika email tersebut terdaftar, tautan atur ulang sudah dikirim.
          Periksa kotak masuk Anda.
        </p>
      ) : (
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-900">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Mengirim…" : "Kirim tautan"}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <a className="underline" href="/login">
          Kembali masuk
        </a>
      </p>
    </main>
  );
}
