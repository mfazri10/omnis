"use client";

import { PageHeader } from "@/components/shared/page-header";

import { useMutation, useQuery } from "@apollo/client/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import { PermissionGate } from "../../../../../features/rbac/components/permission-gate";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import {
  ADMIN_ASSIGNMENTS_QUERY,
  ADMIN_QUERY,
  SET_ADMIN_ACTIVE_MUTATION,
  UPDATE_ADMIN_MUTATION,
} from "../../../../../features/rbac/graphql/admins.graphql";
import { APPS_QUERY } from "../../../../../features/rbac/graphql/permissions.graphql";
import {
  ASSIGN_ROLE_MUTATION,
  ROLES_QUERY,
  UNASSIGN_ROLE_MUTATION,
} from "../../../../../features/rbac/graphql/roles.graphql";
import { useEffectivePermissions } from "../../../../../features/rbac/hooks/use-effective-permissions";

const inputClass = "min-h-11 max-w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

function AssignForm({ adminId }: { adminId: string }): JSX.Element {
  const { data: rolesData } = useQuery(ROLES_QUERY);
  const { data: appsData } = useQuery(APPS_QUERY);
  const [assignRole, { loading: saving }] = useMutation(ASSIGN_ROLE_MUTATION);
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const roles = rolesData?.roles ?? [];
  const chosen = roles.find((r) => r.id === roleId);
  const chosenApp =
    chosen?.appId == null
      ? null
      : (appsData?.apps ?? []).find((a) => a.id === chosen.appId) ?? null;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!chosen) {
      return;
    }
    setError(null);
    try {
      await assignRole({
        variables: {
          adminId,
          roleId: chosen.id,
          appId: chosen.appId,
        },
        refetchQueries: [
          { query: ADMIN_ASSIGNMENTS_QUERY, variables: { adminId } },
        ],
      });
      setRoleId("");
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal menetapkan role."));
    }
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => void handleSubmit(e)}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-foreground">Tambah penetapan role</span>
        <select
          required
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className={inputClass}
        >
          <option value="">Pilih role…</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name} ({role.scopeType})
            </option>
          ))}
        </select>
      </label>
      {chosen && chosen.scopeType === "app" && (
        <p className="text-sm text-muted-foreground">
          Berlaku untuk aplikasi: {chosenApp?.name ?? chosen.appId}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <button
          type="submit"
          disabled={saving || roleId === ""}
          className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Tetapkan"}
        </button>
      </div>
    </form>
  );
}

function EffectivePanel({ adminId }: { adminId: string }): JSX.Element {
  const { data: assignData } = useQuery(ADMIN_ASSIGNMENTS_QUERY, {
    variables: { adminId },
  });
  const { data: appsData } = useQuery(APPS_QUERY);
  const [contextApp, setContextApp] = useState("");
  const { keys, loading } = useEffectivePermissions(
    adminId,
    contextApp === "" ? null : contextApp,
  );

  const appIds = [
    ...new Set(
      (assignData?.adminAssignments ?? [])
        .map((a) => a.appId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const apps = appsData?.apps ?? [];

  return (
    <div className="text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-foreground">Konteks</span>
        <select
          value={contextApp}
          onChange={(e) => setContextApp(e.target.value)}
          className={inputClass}
        >
          <option value="">Global</option>
          {appIds.map((id) => (
            <option key={id} value={id}>
              {apps.find((a) => a.id === id)?.name ?? id}
            </option>
          ))}
        </select>
      </label>
      {loading && <p className="mt-2 text-muted-foreground">Memuat…</p>}
      {!loading && keys.length === 0 && (
        <p className="mt-2 text-muted-foreground">Tidak ada hak dalam konteks ini.</p>
      )}
      {!loading && keys.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {keys.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminDetailPage(): JSX.Element {
  const params = useParams();
  const raw = params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  const { data, loading, error: queryError } = useQuery(ADMIN_QUERY, {
    variables: { id },
    skip: id === "",
  });
  const { data: assignData, refetch: refetchAssignments } = useQuery(
    ADMIN_ASSIGNMENTS_QUERY,
    { variables: { adminId: id }, skip: id === "" },
  );
  const [updateAdmin, { loading: saving }] = useMutation(UPDATE_ADMIN_MUTATION);
  const [setActive, { loading: toggling }] = useMutation(SET_ADMIN_ACTIVE_MUTATION);
  const [unassignRole] = useMutation(UNASSIGN_ROLE_MUTATION);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const admin = data?.admin;
  const shownName = name ?? admin?.name ?? "";

  async function handleRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await updateAdmin({ variables: { id, input: { name: shownName } } });
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal menyimpan nama."));
    }
  }

  async function handleToggle(nextActive: boolean): Promise<void> {
    if (
      !nextActive &&
      !window.confirm(
        `Nonaktifkan ${admin?.name ?? "admin ini"}? Sesinya langsung dicabut.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await setActive({ variables: { id, active: nextActive } });
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal mengubah status."));
    }
  }

  async function handleUnassign(
    roleId: string,
    roleName: string,
    appId: string | null,
  ): Promise<void> {
    if (!window.confirm(`Cabut role "${roleName}"?`)) {
      return;
    }
    setError(null);
    try {
      await unassignRole({ variables: { adminId: id, roleId, appId } });
      await refetchAssignments();
    } catch (err: unknown) {
      setError(graphQLErrorMessage(err, "Gagal mencabut role."));
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader title="Kelola admin" />
      {loading && <p className="mt-6 text-foreground">Memuat…</p>}
      {queryError && (
        <p className="mt-6 text-sm text-destructive">
          {graphQLErrorMessage(queryError, "Gagal memuat admin.")}
        </p>
      )}
      {data && !admin && (
        <p className="mt-6 text-sm text-destructive">Admin tidak ditemukan.</p>
      )}
      {admin && (
        <div className="mt-6 flex flex-col gap-8">
          <section>
            <h2 className="text-sm font-semibold">Profil</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {admin.email} · {admin.isSuperAdmin ? "Super Admin" : "Admin"} ·{" "}
              {admin.isActive ? "Aktif" : "Nonaktif"}
            </p>
            <PermissionGate requires="platform.admins.manage">
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => void handleRename(e)}
              >
                <input
                  type="text"
                  required
                  aria-label="Nama"
                  value={shownName}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {saving ? "Menyimpan…" : "Ubah nama"}
                </button>
              </form>
              <button
                type="button"
                disabled={toggling}
                onClick={() => void handleToggle(!admin.isActive)}
                className="mt-3 text-sm text-destructive underline disabled:opacity-50"
              >
                {admin.isActive ? "Nonaktifkan" : "Aktifkan kembali"}
              </button>
            </PermissionGate>
          </section>
          <section>
            <h2 className="text-sm font-semibold">
              Penetapan role
            </h2>
            {(assignData?.adminAssignments ?? []).length === 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Belum ada penetapan role.
              </p>
            )}
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {(assignData?.adminAssignments ?? []).map((a) => (
                <li
                  key={`${a.roleId}:${a.appId ?? "global"}`}
                  className="flex items-center gap-3"
                >
                  <span>
                    {a.roleName} ({a.scopeType}
                    {a.appSlug ? ` · ${a.appSlug}` : ""})
                  </span>
                  <PermissionGate requires="platform.roles.manage">
                    <button
                      type="button"
                      onClick={() =>
                        void handleUnassign(a.roleId, a.roleName, a.appId)
                      }
                      className="underline"
                    >
                      Cabut
                    </button>
                  </PermissionGate>
                </li>
              ))}
            </ul>
            <PermissionGate requires="platform.roles.manage">
              <div className="mt-4">
                <AssignForm adminId={id} />
              </div>
            </PermissionGate>
          </section>
          <section>
            <h2 className="text-sm font-semibold">
              Akses efektif
            </h2>
            <div className="mt-1">
              <EffectivePanel adminId={id} />
            </div>
          </section>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </main>
  );
}
