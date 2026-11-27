"use client";

import { useState } from "react";
import type { FormEvent, JSX } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/page-state";
import { AuthField, AuthPanel } from "@/features/auth/components/auth-panel";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      const result = await authClient.requestPasswordReset({ email });
      if (result.error) {
        setFailed(true);
        return;
      }
      setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPanel title="Lupa kata sandi" description="Masukkan email akun admin Anda.">
      {done ? (
        <p role="status" className="mt-4 text-sm">
          Jika email terdaftar, tautan atur ulang dikirim. Periksa kotak masuk Anda.
        </p>
      ) : (
        <form className="mt-6 flex flex-col gap-4" aria-busy={busy} onSubmit={(e) => void handleSubmit(e)}>
          <AuthField id="forgot-email" label="Email" type="email" required autoComplete="username"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          {failed && <ErrorState>Tautan belum bisa dikirim. Coba lagi.</ErrorState>}
          <Button className="min-h-11" type="submit" disabled={busy}>{busy ? "Mengirim…" : "Kirim tautan"}</Button>
        </form>
      )}
      <Link href="/login" className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
        Kembali masuk
      </Link>
    </AuthPanel>
  );
}
