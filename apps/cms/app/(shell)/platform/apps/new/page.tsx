"use client";

import { useMutation } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import { MY_APPS_QUERY } from "../../../../../features/shell/graphql/session.graphql";
import { PROVISION_APP_MUTATION } from "../../../../../features/apps/graphql/apps.graphql";

const inputClass = "border border-slate-300 px-3 py-2 text-slate-900";

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
    <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Tambah aplikasi
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Menyimpan formulir ini langsung memprovisioning: database dibuat,
        dimigrasi, dan diisi config awal.
      </p>
      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-900">Nama</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-900">
            Slug (huruf kecil/angka/strip, 3–64 karakter)
          </span>
          <input
            type="text"
            required
            pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-900">Catatan (opsional)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>
        <fieldset className="border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-900">
            Modul domain
          </legend>
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              checked={cbtModule}
              onChange={(e) => setCbtModule(e.target.checked)}
              className="h-4 w-4"
            />
            CBT (Tes CPNS): bank soal, paket, sesi, hasil &amp; analitik
          </label>
          <p className="text-xs text-slate-600">
            Modul yang dipilih ikut dimigrasi ke database aplikasi saat
            provisioning.
          </p>
        </fieldset>
        {provisioning && (
          <p className="text-sm text-slate-600">
            Memprovisioning: membuat database dan menjalankan migrasi…
          </p>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={provisioning}
            className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {provisioning ? "Memprovisioning…" : "Buat + Provisioning"}
          </button>
          <a className="px-4 py-2 text-sm underline" href="/platform/apps">
            Batal
          </a>
        </div>
      </form>
    </main>
  );
}
