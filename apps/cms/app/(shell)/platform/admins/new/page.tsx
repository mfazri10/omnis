"use client";

import { useMutation } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import { CREATE_ADMIN_MUTATION } from "../../../../../features/rbac/graphql/admins.graphql";

const inputClass = "border border-slate-300 px-3 py-2 text-slate-900";

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
    <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Tambah admin
      </h1>
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
          <span className="text-slate-900">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-900">Kata sandi awal (min. 8 karakter)</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
          <a className="px-4 py-2 text-sm underline" href="/platform/admins">
            Batal
          </a>
        </div>
      </form>
    </main>
  );
}
