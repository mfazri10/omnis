"use client";

import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/shared/button-link";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/page-state";
import { AuthField } from "@/features/auth/components/auth-panel";
import { CMS_PICKER_PATH } from "@/features/shell/routes";
import { authClient } from "@/lib/auth-client";

export default function ChangePasswordPage(): JSX.Element {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (password.length < 8) {
      setError("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi tidak sama.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.changePassword({
        currentPassword: current,
        newPassword: password,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError("Kata sandi saat ini salah.");
        return;
      }
      setDone(true);
    } catch {
      setError("Kata sandi belum bisa diubah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6 sm:px-6">
      <PageHeader title="Ubah kata sandi" />
      {done ? (
        <>
          <p className="mt-4 text-sm" role="status">Kata sandi berhasil diubah.</p>
          <ButtonLink href={CMS_PICKER_PATH} className="mt-4">Kembali ke pemilih aplikasi</ButtonLink>
        </>
      ) : (
        <form className="mt-6 flex flex-col gap-4" aria-busy={busy} onSubmit={(e) => void handleSubmit(e)}>
          <AuthField id="change-current" label="Kata sandi saat ini" type="password" required autoComplete="current-password"
            value={current} onChange={(e) => setCurrent(e.target.value)} />
          <AuthField id="change-new" label="Kata sandi baru" type="password" required autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <AuthField id="change-confirm" label="Konfirmasi kata sandi" type="password" required autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <ErrorState>{error}</ErrorState>}
          <Button className="min-h-11" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Ubah kata sandi"}</Button>
        </form>
      )}
    </main>
  );
}
