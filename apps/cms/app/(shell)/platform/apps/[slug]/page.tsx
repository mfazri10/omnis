"use client";

import { PageHeader } from "@/components/shared/page-header";

import { useMutation, useQuery } from "@apollo/client/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { PermissionGate } from "../../../../../features/rbac/components/permission-gate";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import type { AppDetailData } from "../../../../../features/apps/graphql/apps.graphql";
import {
  APP_QUERY,
  ARCHIVE_APP_MUTATION,
  DELETE_APP_MUTATION,
  RETRY_PROVISION_MUTATION,
  SET_FCM_MUTATION,
  SUSPEND_APP_MUTATION,
  UNSUSPEND_APP_MUTATION,
  UPDATE_APP_MUTATION,
} from "../../../../../features/apps/graphql/apps.graphql";

const inputClass = "border border-slate-300 px-3 py-2 text-slate-900";

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <p className="text-sm">
      <span className="text-slate-600">{label}: </span>
      <span className="text-slate-900">{value}</span>
    </p>
  );
}

function StatusActions({ app }: { app: AppDetailData }): JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [suspendApp, { loading: suspending }] = useMutation(SUSPEND_APP_MUTATION);
  const [unsuspendApp, { loading: unsuspending }] = useMutation(UNSUSPEND_APP_MUTATION);
  const [archiveApp, { loading: archiving }] = useMutation(ARCHIVE_APP_MUTATION);
  const [retryProvision, { loading: retrying }] = useMutation(RETRY_PROVISION_MUTATION);
  const [deleteApp, { loading: deleting }] = useMutation(DELETE_APP_MUTATION);
  const busy = suspending || unsuspending || archiving || retrying || deleting;

  async function run(
    label: string,
    action: () => Promise<unknown>,
    confirm?: string,
  ): Promise<void> {
    if (confirm && !window.confirm(confirm)) {
      return;
    }
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, `Gagal ${label}.`));
    }
  }

  function refetch(): { refetchQueries: [{ query: typeof APP_QUERY; variables: { slug: string } }] } {
    return { refetchQueries: [{ query: APP_QUERY, variables: { slug: app.slug } }] };
  }

  return (
    <PermissionGate requires="platform.apps.manage">
      <div className="flex flex-wrap gap-3 text-sm">
        {app.status === "active" && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run("men-suspend", () =>
                suspendApp({ variables: { id: app.id }, ...refetch() }),
              )
            }
            className="underline disabled:opacity-50"
          >
            {suspending ? "Memproses…" : "Suspend"}
          </button>
        )}
        {app.status === "suspended" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run("mengaktifkan", () =>
                  unsuspendApp({ variables: { id: app.id }, ...refetch() }),
                )
              }
              className="underline disabled:opacity-50"
            >
              {unsuspending ? "Memproses…" : "Aktifkan kembali"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  "mengarsipkan",
                  () =>
                    archiveApp({ variables: { id: app.id }, ...refetch() }),
                  `Arsipkan ${app.name}?`,
                )
              }
              className="underline disabled:opacity-50"
            >
              {archiving ? "Memproses…" : "Arsipkan"}
            </button>
          </>
        )}
        {app.status === "active" && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                "mengarsipkan",
                () => archiveApp({ variables: { id: app.id }, ...refetch() }),
                `Arsipkan ${app.name}?`,
              )
            }
            className="underline disabled:opacity-50"
          >
            Arsipkan
          </button>
        )}
        {app.status === "failed" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run("mengulang provisioning", () =>
                  retryProvision({ variables: { slug: app.slug }, ...refetch() }),
                )
              }
              className="bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {retrying ? "Memprovisioning…" : "Ulangi provisioning"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  "menghapus",
                  async () => {
                    await deleteApp({ variables: { id: app.id } });
                    router.push("/platform/apps");
                  },
                  `Hapus ${app.name} permanen?`,
                )
              }
              className="text-red-700 underline disabled:opacity-50"
            >
              Hapus permanen
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </PermissionGate>
  );
}

function FcmCard({ app }: { app: AppDetailData }): JSX.Element {
  const [setFcm, { loading: saving }] = useMutation(SET_FCM_MUTATION);
  const [json, setJson] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await setFcm({
        variables: { appId: app.id, serviceAccountJson: json },
        refetchQueries: [{ query: APP_QUERY, variables: { slug: app.slug } }],
      });
      setJson("");
      setEditing(false);
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal menyimpan kredensial."));
    }
  }

  return (
    <div className="text-sm">
      <p className="text-slate-900">
        Kredensial FCM:{" "}
        {app.fcmConfigured ? "Terpasang ••••" : "Belum terpasang"}
      </p>
      <PermissionGate requires="platform.apps.manage">
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 underline"
          >
            {app.fcmConfigured ? "Ganti kredensial" : "Pasang kredensial"}
          </button>
        )}
        {editing && (
          <form
            className="mt-2 flex flex-col gap-2"
            onSubmit={(e) => void handleSubmit(e)}
          >
            <label className="flex flex-col gap-1">
              <span className="text-slate-900">
                Tempel service account JSON
              </span>
              <textarea
                required
                rows={6}
                value={json}
                onChange={(e) => setJson(e.target.value)}
                className={inputClass}
              />
            </label>
            {error && <p className="text-red-700">{error}</p>}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="underline"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </PermissionGate>
    </div>
  );
}

function UpdateForm({ app }: { app: AppDetailData }): JSX.Element {
  const [updateApp, { loading: saving }] = useMutation(UPDATE_APP_MUTATION);
  const [name, setName] = useState(app.name);
  const [notes, setNotes] = useState(app.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await updateApp({
        variables: {
          id: app.id,
          input: { name, notes: notes === "" ? null : notes },
        },
        refetchQueries: [{ query: APP_QUERY, variables: { slug: app.slug } }],
      });
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal menyimpan."));
    }
  }

  return (
    <PermissionGate requires="platform.apps.manage">
      <form
        className="flex flex-col gap-3 text-sm"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <label className="flex flex-col gap-1">
          <span className="text-slate-900">Nama</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-900">Catatan</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>
        {error && <p className="text-red-700">{error}</p>}
        <div>
          <button
            type="submit"
            disabled={saving}
            className="bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan info"}
          </button>
        </div>
      </form>
    </PermissionGate>
  );
}

export default function AppDetailPage(): JSX.Element {
  const params = useParams();
  const raw = params.slug;
  const slug = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  const { data, loading, error } = useQuery(APP_QUERY, {
    variables: { slug },
    skip: slug === "",
  });
  const app = data?.app;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader title={app?.name ?? "Detail aplikasi"} />
      {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
      {error && (
        <p className="mt-6 text-sm text-red-700">
          {graphQLErrorMessage(error, "Gagal memuat aplikasi.")}
        </p>
      )}
      {app && (
        <div className="mt-6 flex flex-col gap-8">
          <section className="flex flex-col gap-1">
            <InfoRow label="Slug" value={app.slug} />
            <InfoRow label="Status" value={app.status} />
            <InfoRow label="Database" value={app.dbName} />
            {app.androidPackage && (
              <InfoRow label="Paket Android" value={app.androidPackage} />
            )}
            {app.iosBundleId && (
              <InfoRow label="Bundle iOS" value={app.iosBundleId} />
            )}
            {app.failureReason && (
              <p className="mt-2 text-sm text-red-700">
                Gagal: {app.failureReason}
              </p>
            )}
          </section>
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Aksi</h2>
            <div className="mt-1">
              <StatusActions app={app} />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-slate-900">FCM</h2>
            <div className="mt-1">
              <FcmCard app={app} />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Ubah info</h2>
            <div className="mt-1">
              <UpdateForm key={app.id} app={app} />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
