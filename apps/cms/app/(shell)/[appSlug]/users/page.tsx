"use client";

import { PageHeader } from "@/components/shared/page-header";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { ErrorState, LoadingState } from "@/components/shared/page-state";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@apollo/client/react";
import { use, useEffect, useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import {
  APP_USERS_QUERY,
  CREATE_APP_USER_MUTATION,
  SET_APP_USER_ACTIVE_MUTATION,
  UPDATE_APP_USER_MUTATION,
} from "../../../../features/app-users/graphql/app-users.graphql";
import type {
  AppUserData,
  AppUsersFilter,
  CreateAppUserInput,
  UpdateAppUserInput,
} from "../../../../features/app-users/graphql/app-users.graphql";
import { ExportButton } from "../../../../features/exports/components/export-button";
import { EXPORT_APP_USERS_MUTATION } from "../../../../features/exports/graphql/exports.graphql";
import { useSessionStore } from "../../../../stores/use-session-store";

const PER_PAGE = 20;

const CONTROL_CLASS =
  "min-h-11 max-w-full rounded-md border border-input bg-card px-3 py-2 text-sm";
const LABEL_CLASS = "text-sm font-medium text-muted-foreground";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function contactOf(user: AppUserData): string {
  if (user.email && user.phone) {
    return `${user.email} / ${user.phone}`;
  }
  return user.email ?? user.phone ?? "–";
}

interface FilterDraft {
  search: string;
  status: string;
}

const EMPTY_FILTER: FilterDraft = { search: "", status: "" };

function isFiltered(draft: FilterDraft): boolean {
  return draft.search.trim() !== "" || draft.status !== "";
}

function toFilterInput(draft: FilterDraft): AppUsersFilter | null {
  const filter: AppUsersFilter = {};
  if (draft.search.trim() !== "") {
    filter.search = draft.search.trim();
  }
  if (draft.status !== "") {
    filter.status = draft.status;
  }
  return Object.keys(filter).length > 0 ? filter : null;
}

type StatusMessage = { kind: "sukses" | "gagal"; text: string };

interface UserFormProps {
  initial: AppUserData | null;
  onDone: (status: StatusMessage) => void;
  onCancel: () => void;
}

function UserForm({ initial, onDone, onCancel }: UserFormProps): JSX.Element {
  const [createUser, { loading: creating }] = useMutation(
    CREATE_APP_USER_MUTATION,
  );
  const [updateUser, { loading: updating }] = useMutation(
    UPDATE_APP_USER_MUTATION,
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatarUrl ?? "");
  const [metadata, setMetadata] = useState(initial?.metadata ?? "");
  const saving = creating || updating;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName === "") {
      onDone({ kind: "gagal", text: "Nama wajib diisi." });
      return;
    }
    try {
      if (initial === null) {
        const input: CreateAppUserInput = {
          name: trimmedName,
          email: nullIfEmpty(email) ?? undefined,
          phone: nullIfEmpty(phone) ?? undefined,
          avatarUrl: nullIfEmpty(avatarUrl) ?? undefined,
          metadata: nullIfEmpty(metadata) ?? undefined,
        };
        await createUser({
          variables: { input },
          refetchQueries: [APP_USERS_QUERY],
          awaitRefetchQueries: true,
        });
        onDone({ kind: "sukses", text: "User aplikasi ditambahkan." });
      } else {
        const input: UpdateAppUserInput = {
          name: trimmedName,
          email: nullIfEmpty(email),
          phone: nullIfEmpty(phone),
          avatarUrl: nullIfEmpty(avatarUrl),
          metadata: nullIfEmpty(metadata),
        };
        await updateUser({
          variables: { id: initial.id, input },
          refetchQueries: [APP_USERS_QUERY],
          awaitRefetchQueries: true,
        });
        onDone({ kind: "sukses", text: "Perubahan user tersimpan." });
      }
    } catch (err: unknown) {
      onDone({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal menyimpan user."),
      });
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        {initial === null ? "Tambah user" : `Ubah user: ${initial.name}`}
      </h2>
      <form
        className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Nama (wajib)</span>
          <input
            type="text"
            required
            value={name}
            maxLength={255}
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama lengkap"
            className={CONTROL_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Email</span>
          <input
            type="email"
            value={email}
            maxLength={255}
            disabled={saving}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@contoh.id"
            className={CONTROL_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Nomor telepon</span>
          <input
            type="tel"
            value={phone}
            disabled={saving}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+6281234567890"
            className={CONTROL_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>URL avatar</span>
          <input
            type="url"
            value={avatarUrl}
            maxLength={512}
            disabled={saving}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
            className={CONTROL_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className={LABEL_CLASS}>Metadata (JSON object, opsional)</span>
          <textarea
            rows={3}
            value={metadata}
            disabled={saving}
            onChange={(e) => setMetadata(e.target.value)}
            placeholder='Contoh: {"outlet":"kasir-1"}'
            className={CONTROL_CLASS}
          />
        </label>
        <p className="text-xs text-slate-600 md:col-span-2">
          Minimal salah satu dari email atau nomor telepon wajib diisi.
        </p>
        <div className="flex gap-2 md:col-span-2">
          <Button
            type="submit"
            disabled={saving}
            className="min-h-11"
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={onCancel}
            variant="outline"
            className="min-h-11"
          >
            Batal
          </Button>
        </div>
      </form>
    </section>
  );
}

export default function AppUsersPage({
  params,
}: {
  params: Promise<{ appSlug: string }>;
}): JSX.Element {
  const { appSlug } = use(params);
  const ready = useSessionStore((state) => state.ready);
  const admin = useSessionStore((state) => state.admin);
  const activeSlug = useSessionStore((state) => state.activeSlug);
  const permissions = useSessionStore((state) => state.permissions);

  const canView =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.users.view");
  const canManage =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.users.manage");

  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTER);
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUserData | null>(null);

  const [setActive, { loading: toggling }] = useMutation(
    SET_APP_USER_ACTIVE_MUTATION,
  );

  const contextReady = ready && activeSlug === appSlug;
  const { data, loading, error, refetch } = useQuery(APP_USERS_QUERY, {
    variables: {
      page,
      perPage: PER_PAGE,
      filter: toFilterInput(applied),
    },
    skip: !canView || !contextReady,
  });

  function handleApply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    setApplied(draft);
  }

  function handleReset(): void {
    setDraft(EMPTY_FILTER);
    setApplied(EMPTY_FILTER);
    setPage(1);
  }

  function openCreate(): void {
    setEditing(null);
    setStatus(null);
    setFormOpen(true);
  }

  function openEdit(user: AppUserData): void {
    setEditing(user);
    setStatus(null);
    setFormOpen(true);
  }

  async function handleToggle(user: AppUserData): Promise<void> {
    const action = user.isActive ? "menonaktifkan" : "mengaktifkan";
    const confirmed = window.confirm(
      `Anda yakin ingin ${action} user "${user.name}"?`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await setActive({
        variables: { id: user.id, active: !user.isActive },
        refetchQueries: [APP_USERS_QUERY],
        awaitRefetchQueries: true,
      });
      setStatus({
        kind: "sukses",
        text: user.isActive
          ? `User "${user.name}" dinonaktifkan.`
          : `User "${user.name}" diaktifkan.`,
      });
    } catch (err: unknown) {
      setStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal mengubah status user."),
      });
    }
  }

  const total = data?.appUsers.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  useEffect(() => {
    if (data && !loading && page > lastPage) setPage(lastPage);
  }, [data, lastPage, loading, page]);

  const columns: ColumnDef<AppUserData>[] = [
    { id: "name", header: "Nama", cell: ({ row: { original: user } }) => (
      <span className="flex items-center gap-2">
        {user.avatarUrl && <img src={user.avatarUrl} alt="" width={24} height={24}
          className="size-6 rounded-sm object-cover" />}
        <span className="max-w-64 whitespace-normal wrap-anywhere">{user.name}</span>
      </span>
    ) },
    { id: "contact", header: "Kontak", cell: ({ row }) => contactOf(row.original) },
    { id: "status", header: "Status", cell: ({ row }) => <StatusBadge
      label={row.original.isActive ? "Aktif" : "Nonaktif"} tone={row.original.isActive ? "success" : "neutral"} /> },
    { id: "lastLogin", header: "Terakhir login", cell: ({ row }) =>
      row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : "Belum pernah" },
  ];
  if (canManage) {
    columns.push({ id: "actions", header: "Aksi", cell: ({ row: { original: user } }) => (
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => openEdit(user)}>Ubah</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={toggling}
          onClick={() => void handleToggle(user)}>{user.isActive ? "Nonaktifkan" : "Aktifkan"}</Button>
      </div>
    ) });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Pengguna aplikasi" description={appSlug} />
      {!ready && <LoadingState />}
      {ready && !canView && (
        <p className="mt-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat user aplikasi ini.
        </p>
      )}
      {ready && canView && (
        <>
          {!contextReady && (
            <p className="mt-6 text-slate-900">Menyiapkan konteks…</p>
          )}
          {contextReady && (
            <>
              <TableToolbar onSubmit={handleApply}>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Pencarian</span>
                  <input
                    type="search"
                    placeholder="Cari nama, email, telepon…"
                    value={draft.search}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, search: e.target.value }))
                    }
                    className={CONTROL_CLASS}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Status</span>
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className={CONTROL_CLASS}
                  >
                    <option value="">Semua status</option>
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Terapkan filter
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="min-h-[44px] border border-slate-300 px-4 py-2 text-sm text-slate-900"
                  >
                    Atur ulang
                  </button>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="min-h-[44px] border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    Tambah user
                  </button>
                )}
                <ExportButton
                  requestMutation={EXPORT_APP_USERS_MUTATION}
                  filter={toFilterInput(applied)}
                  labelSumber="user aplikasi"
                />
              </TableToolbar>

              {status && (
                <p
                  className={
                    status.kind === "sukses"
                      ? "mt-4 text-sm text-green-700"
                      : "mt-4 text-sm text-red-700"
                  }
                >
                  {status.text}
                </p>
              )}

              {formOpen && canManage && (
                <div className="mt-6">
                  <UserForm
                    key={editing ? editing.id : "baru"}
                    initial={editing}
                    onCancel={() => setFormOpen(false)}
                    onDone={(next) => {
                      setStatus(next);
                      if (next.kind === "sukses") {
                        setFormOpen(false);
                      }
                    }}
                  />
                </div>
              )}

              {(loading || page > lastPage) && <LoadingState />}
              {error && <ErrorState onRetry={() => void refetch()}>{graphQLErrorMessage(error, "Gagal memuat pengguna aplikasi.")}</ErrorState>}
              {data && !loading && !error && page <= lastPage && <DataTable
                rows={data.appUsers.items} columns={columns} getRowId={(user) => user.id}
                label="Daftar pengguna"
                emptyMessage={isFiltered(applied) ? "Tidak ada pengguna yang cocok dengan filter." : "Belum ada pengguna di aplikasi ini."}
                pagination={{ pageIndex: page - 1, pageSize: PER_PAGE, totalRows: total, onPageChange: (index) => setPage(index + 1) }}
              />}
            </>
          )}
        </>
      )}
    </main>
  );
}
