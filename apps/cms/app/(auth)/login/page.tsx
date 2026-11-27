"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent, JSX } from "react";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth-client";
import { CMS_PICKER_PATH } from "@/features/shell/routes";
import { AuthField, AuthPanel } from "@/features/auth/components/auth-panel";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/page-state";

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    if (session) router.replace(CMS_PICKER_PATH);
  }, [router, session]);

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
      router.replace(CMS_PICKER_PATH);
      router.refresh();
    } catch {
      setError("Tidak bisa masuk. Periksa koneksi dan coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPanel title="Masuk" description="Gunakan akun admin untuk membuka ruang kerja CMS.">
      <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)} aria-busy={busy}>
        <AuthField id="login-email" label="Email" type="email" required autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <AuthField id="login-password" label="Kata sandi" type="password" required autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <ErrorState>{error}</ErrorState>}
        <Button className="min-h-11" type="submit" disabled={busy}>
          {busy ? "Memeriksa…" : "Masuk"}
        </Button>
      </form>
      <Link className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4" href="/forgot-password">
        Lupa kata sandi?
      </Link>
    </AuthPanel>
  );
}
