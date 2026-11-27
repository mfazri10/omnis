"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/shared/button-link";
import { ErrorState } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useMutation } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import { CREATE_ADMIN_MUTATION } from "../../../../../features/rbac/graphql/admins.graphql";

const inputClass = "min-h-11 bg-card";

export default function NewAdminPage(): JSX.Element {
  const router = useRouter();
  const [createAdmin, { loading: saving }] = useMutation(CREATE_ADMIN_MUTATION);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const result = await createAdmin({
        variables: { input: { name, email, password } },
      });
      const id = result.data?.createAdmin.id;
      router.push(id ? `/platform/admins/${id}` : "/platform/admins");
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal membuat admin."));
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader title="Tambah admin" />
      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">Nama</span>
          <Input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">Email</span>
          <Input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">Kata sandi awal (min. 8 karakter)</span>
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && <ErrorState>{error}</ErrorState>}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={saving}
            className="min-h-11"
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
          <ButtonLink variant="outline" href="/platform/admins">Batal</ButtonLink>
        </div>
      </form>
    </main>
  );
}
