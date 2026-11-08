"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { authClient } from "../../../lib/auth-client";

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError("Email atau kata sandi salah.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Masuk</h1>
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-900">Kata sandi</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-slate-300 px-3 py-2 text-slate-900"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <a className="underline" href="/forgot-password">
          Lupa kata sandi?
        </a>
      </p>
    </main>
  );
}
