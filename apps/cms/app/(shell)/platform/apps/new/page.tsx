"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/shared/button-link";
import { ErrorState, LoadingState } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useMutation } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import { MY_APPS_QUERY } from "../../../../../features/shell/graphql/session.graphql";
import { PROVISION_APP_MUTATION } from "../../../../../features/apps/graphql/apps.graphql";

const inputClass = "min-h-11 bg-card";

export default function NewAppPage(): JSX.Element {
  const router = useRouter();
  const [provisionApp, { loading: provisioning }] =
    useMutation(PROVISION_APP_MUTATION);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [notes, setNotes] = useState("");
  const [cbtModule, setCbtModule] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const result = await provisionApp({
        variables: {
          input: {
            name,
            slug,
            notes: notes === "" ? null : notes,
            modules: cbtModule ? ["cbt"] : [],
          },
        },
          refetchQueries: [{ query: MY_APPS_QUERY }],
          awaitRefetchQueries: true,
      });
      const created = result.data?.provisionApp;
      router.push(
        created ? `/platform/apps/${created.slug}` : "/platform/apps",
      );
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal memprovisioning aplikasi."));
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader title="Tambah aplikasi" description="CMS akan membuat database dan menyiapkan konfigurasi awal." />
      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => void handleSubmit(e)}
        aria-busy={provisioning}
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
          <span className="text-foreground">
            Slug (huruf kecil/angka/strip, 3–64 karakter)
          </span>
          <Input
            type="text"
            required
            pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">Catatan (opsional)</span>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>
        <fieldset className="rounded-lg border border-border bg-card p-3">
          <legend className="px-1 text-sm font-semibold">
            Modul domain
          </legend>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cbtModule}
              onChange={(e) => setCbtModule(e.target.checked)}
              className="h-4 w-4"
            />
            CBT (Tes CPNS): bank soal, paket, sesi, hasil &amp; analitik
          </label>
          <p className="text-xs text-muted-foreground">
            Modul yang dipilih ikut dimigrasi ke database aplikasi saat
            provisioning.
          </p>
        </fieldset>
        {provisioning && <LoadingState>Membuat database dan menjalankan migrasi…</LoadingState>}
        {error && <ErrorState>{error}</ErrorState>}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={provisioning}
            className="min-h-11"
          >
            {provisioning ? "Memprovisioning…" : "Buat + Provisioning"}
          </Button>
          <ButtonLink variant="outline" href="/platform/apps">Batal</ButtonLink>
        </div>
      </form>
    </main>
  );
}
