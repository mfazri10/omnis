"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent, JSX } from "react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/shared/button-link";
import { ErrorState, LoadingState } from "@/components/shared/page-state";
import { AuthField, AuthPanel } from "@/features/auth/components/auth-panel";
import { authClient } from "@/lib/auth-client";

function ResetForm(): JSX.Element {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;
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
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError("Tautan kedaluwarsa atau tidak valid. Minta tautan baru.");
        return;
      }
      setDone(true);
    } catch {
      setError("Kata sandi belum bisa disimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <>
    <ErrorState>Tautan tidak valid.</ErrorState>
    <ButtonLink href="/forgot-password">Minta tautan baru</ButtonLink>
  </>;

  if (done) return <>
    <p role="status" className="mt-4 text-sm">Kata sandi berhasil diubah.</p>
    <ButtonLink href="/login" className="mt-4">Masuk</ButtonLink>
  </>;

  return (
    <form className="mt-6 flex flex-col gap-4" aria-busy={busy} onSubmit={(e) => void handleSubmit(e)}>
      <AuthField id="reset-password" label="Kata sandi baru" type="password" required autoComplete="new-password"
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <AuthField id="reset-confirm" label="Konfirmasi kata sandi" type="password" required autoComplete="new-password"
        value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {error && <ErrorState>{error}</ErrorState>}
      <Button className="min-h-11" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan kata sandi"}</Button>
    </form>
  );
}

export default function ResetPasswordPage(): JSX.Element {
  return (
    <AuthPanel title="Atur ulang kata sandi">
      <Suspense fallback={<LoadingState />}>
        <ResetForm />
      </Suspense>
    </AuthPanel>
  );
}
