"use client";

import { PageHeader } from "@/components/shared/page-header";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared/page-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useMutation, useQuery } from "@apollo/client/react";
import { use, useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import {
  CREATE_MOBILE_MENU_MUTATION,
  DELETE_MOBILE_MENU_MUTATION,
  MOBILE_MENUS_QUERY,
  UPDATE_MOBILE_MENU_MUTATION,
} from "../../../../features/mobile-menus/graphql/mobile-menus.graphql";
import type {
  CreateMobileMenuInput,
  MobileMenuData,
} from "../../../../features/mobile-menus/graphql/mobile-menus.graphql";
import {
  buildMenuTree,
  excludedParentIds,
  type MenuTreeNode,
} from "../../../../features/mobile-menus/menu-tree";
import { useSessionStore } from "../../../../stores/use-session-store";

const NO_PARENT = "__root";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_PATTERN = /^[a-z][a-z0-9._-]{0,254}$/;

type StatusMessage = { kind: "sukses" | "gagal"; text: string };

interface MenuFormProps {
  menus: MobileMenuData[];
  /** Menu yang diubah; null berarti membuat menu baru. */
  editing: MobileMenuData | null;
  /** Parent yang sudah ditentukan tombol "Tambah sub". */
  presetParentId: string | null;
  onCancel: () => void;
  onDone: (status: StatusMessage) => void;
}

function MenuForm({
  menus,
  editing,
  presetParentId,
  onCancel,
  onDone,
}: MenuFormProps): JSX.Element {
  const [createMenu, { loading: creating }] = useMutation(
    CREATE_MOBILE_MENU_MUTATION,
  );
  const [updateMenu, { loading: updating }] = useMutation(
    UPDATE_MOBILE_MENU_MUTATION,
  );
  const [name, setName] = useState(editing?.name ?? "");
  const [slug, setSlug] = useState(editing?.slug ?? "");
  const [parentId, setParentId] = useState(
    editing?.parentId ?? presetParentId ?? NO_PARENT,
  );
  const [routeKey, setRouteKey] = useState(editing?.routeKey ?? "");
  const [iconKey, setIconKey] = useState(editing?.iconKey ?? "");
  const [orderNo, setOrderNo] = useState(String(editing?.orderNo ?? 0));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [errors, setErrors] = useState<string[]>([]);
  const saving = creating || updating;

  const excluded = excludedParentIds(menus, editing?.id ?? null);
  const tree = buildMenuTree(menus);
  const parentOptions: { id: string; label: string }[] = [];
  const walk = (nodes: MenuTreeNode[], depth: number): void => {
    for (const node of nodes) {
      if (excluded.has(node.menu.id)) {
        walk(node.children, depth + 1);
        continue;
      }
      parentOptions.push({
        id: node.menu.id,
        label: `${"— ".repeat(depth)}${node.menu.name} (${node.menu.slug})`,
      });
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);

  function validate(): string[] {
    const found: string[] = [];
    if (name.trim() === "") found.push("Nama wajib diisi.");
    if (!SLUG_PATTERN.test(slug)) {
      found.push(
        "Slug hanya boleh huruf kecil, angka, dan strip di antaranya (mis. beranda-utama).",
      );
    }
    if (routeKey.trim() !== "" && !KEY_PATTERN.test(routeKey.trim())) {
      found.push(
        "Route key harus diawali huruf kecil; hanya huruf kecil, angka, titik, garis bawah, strip (bukan URL/path).",
      );
    }
    if (iconKey.trim() !== "" && !KEY_PATTERN.test(iconKey.trim())) {
      found.push(
        "Icon key harus diawali huruf kecil; hanya huruf kecil, angka, titik, garis bawah, strip.",
      );
    }
    const order = Number(orderNo);
    if (!Number.isInteger(order) || order < 0) {
      found.push("Urutan harus bilangan bulat >= 0.");
    }
    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (found.length > 0) return;
    const resolvedParent = parentId === NO_PARENT ? null : parentId;
    const trimmedRoute = routeKey.trim() === "" ? null : routeKey.trim();
    const trimmedIcon = iconKey.trim() === "" ? null : iconKey.trim();
    try {
      if (editing === null) {
        const input: CreateMobileMenuInput = {
          name: name.trim(),
          slug,
          routeKey: trimmedRoute,
          iconKey: trimmedIcon,
          parentId: resolvedParent,
          orderNo: Number(orderNo),
          isActive,
        };
        await createMenu({
          variables: { input },
          refetchQueries: [MOBILE_MENUS_QUERY],
          awaitRefetchQueries: true,
        });
        onDone({ kind: "sukses", text: `Menu "${input.name}" dibuat.` });
      } else {
        await updateMenu({
          variables: {
            input: {
              id: editing.id,
              name: name.trim(),
              slug,
              routeKey: trimmedRoute,
              iconKey: trimmedIcon,
              parentId: resolvedParent,
              orderNo: Number(orderNo),
              isActive,
            },
          },
          refetchQueries: [MOBILE_MENUS_QUERY],
          awaitRefetchQueries: true,
        });
        onDone({ kind: "sukses", text: `Menu "${name.trim()}" tersimpan.` });
      }
    } catch (err: unknown) {
      onDone({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal menyimpan menu."),
      });
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>
          {editing === null ? "Tambah menu" : `Ubah menu: ${editing.name}`}
        </CardTitle>
        <CardDescription>
          Route key dan icon key adalah identifier layar/ikon aplikasi;
          daftar nilainya menyusul bersama manifest F13.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="menu-name">Nama (wajib)</FieldLabel>
              <Input
                id="menu-name"
                value={name}
                maxLength={255}
                disabled={saving}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="menu-slug">Slug (wajib)</FieldLabel>
              <Input
                id="menu-slug"
                value={slug}
                maxLength={255}
                disabled={saving}
                onChange={(e) => setSlug(e.target.value)}
                className="min-h-11"
              />
              <FieldDescription>
                Identitas stabil, unik per aplikasi (mis. beranda-utama).
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="menu-parent">Parent</FieldLabel>
              <Select
                value={parentId}
                onValueChange={(value) => {
                  setParentId(value ?? NO_PARENT);
                }}
              >
                <SelectTrigger
                  id="menu-parent"
                  aria-label="Parent menu"
                  className="min-h-11 bg-card"
                >
                  <SelectValue>
                    {parentId === NO_PARENT
                      ? "Tanpa parent (akar)"
                      : parentOptions.find((o) => o.id === parentId)?.label ??
                        "Tanpa parent (akar)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false}>
                  <SelectItem value={NO_PARENT} className="min-h-11">
                    Tanpa parent (akar)
                  </SelectItem>
                  {parentOptions.map((option) => (
                    <SelectItem
                      key={option.id}
                      value={option.id}
                      className="min-h-11 wrap-anywhere"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Parent harus dari aplikasi yang sama; diri dan keturunannya
                tidak ditawarkan.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="menu-order">Urutan</FieldLabel>
              <Input
                id="menu-order"
                type="number"
                min={0}
                value={orderNo}
                disabled={saving}
                onChange={(e) => setOrderNo(e.target.value)}
                className="min-h-11"
              />
              <FieldDescription>
                Urutan dalam sibling; urutan seri diputus dengan id.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="menu-route">Route key (opsional)</FieldLabel>
              <Input
                id="menu-route"
                value={routeKey}
                maxLength={255}
                disabled={saving}
                onChange={(e) => setRouteKey(e.target.value)}
                className="min-h-11"
              />
              <FieldDescription>
                Identifier layar terdaftar, bukan URL atau path.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="menu-icon">Icon key (opsional)</FieldLabel>
              <Input
                id="menu-icon"
                value={iconKey}
                maxLength={255}
                disabled={saving}
                onChange={(e) => setIconKey(e.target.value)}
                className="min-h-11"
              />
            </Field>
          </FieldGroup>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              disabled={saving}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            Aktif (diantarkan ke klien mobile)
          </label>
          {errors.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-destructive">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving} className="min-h-11">
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onCancel}
              className="min-h-11"
            >
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface MenuRowProps {
  node: MenuTreeNode;
  depth: number;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  busy: boolean;
  onEdit: (menu: MobileMenuData) => void;
  onAddChild: (parentId: string) => void;
  onToggle: (menu: MobileMenuData) => void;
  onDelete: (menu: MobileMenuData) => void;
  onMove: (node: MenuTreeNode, direction: -1 | 1) => void;
}

function MenuRow({
  node,
  depth,
  canCreate,
  canUpdate,
  canDelete,
  busy,
  onEdit,
  onAddChild,
  onToggle,
  onDelete,
  onMove,
}: MenuRowProps): JSX.Element {
  const { menu, children } = node;
  return (
    <li
      className="flex flex-col gap-2 border-b border-border py-2 last:border-b-0"
      style={{ paddingInlineStart: `${depth * 1.25}rem` }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{menu.name}</span>{" "}
          <span className="text-sm text-muted-foreground">({menu.slug})</span>
        </span>
        {menu.routeKey !== null && (
          <Badge variant="outline">{`route: ${menu.routeKey}`}</Badge>
        )}
        {menu.iconKey !== null && (
          <Badge variant="outline">{`icon: ${menu.iconKey}`}</Badge>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {`urutan ${menu.orderNo}`}
        </span>
        <StatusBadge
          label={menu.isActive ? "Aktif" : "Nonaktif"}
          tone={menu.isActive ? "success" : "neutral"}
        />
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {canUpdate && (
            <>
              <Button
                type="button"
                variant="link"
                className="min-h-11 px-0"
                disabled={busy}
                onClick={() => onMove(node, -1)}
              >
                Naik
              </Button>
              <Button
                type="button"
                variant="link"
                className="min-h-11 px-0"
                disabled={busy}
                onClick={() => onMove(node, 1)}
              >
                Turun
              </Button>
              <Button
                type="button"
                variant="link"
                className="min-h-11 px-0"
                onClick={() => onEdit(menu)}
              >
                Ubah
              </Button>
              <Button
                type="button"
                variant="link"
                className="min-h-11 px-0"
                disabled={busy}
                onClick={() => onToggle(menu)}
              >
                {menu.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </>
          )}
          {canCreate && (
            <Button
              type="button"
              variant="link"
              className="min-h-11 px-0"
              onClick={() => onAddChild(menu.id)}
            >
              Tambah sub
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="link"
              className="min-h-11 px-0 text-destructive"
              disabled={busy}
              onClick={() => onDelete(menu)}
            >
              Hapus
            </Button>
          )}
        </span>
      </div>
      {children.length > 0 && (
        <ul className="flex flex-col">
          {children.map((child) => (
            <MenuRow
              key={child.menu.id}
              node={child}
              depth={depth + 1}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDelete={canDelete}
              busy={busy}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onToggle={onToggle}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function MenuMobilePage({
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
    permissions.includes("platform.mobile-menus.view");
  const canCreate =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.mobile-menus.create");
  const canUpdate =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.mobile-menus.update");
  const canDelete =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.mobile-menus.delete");

  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MobileMenuData | null>(null);
  const [presetParentId, setPresetParentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const contextReady = ready && activeSlug === appSlug;
  const { data, loading, error, refetch } = useQuery(MOBILE_MENUS_QUERY, {
    skip: !canView || !contextReady,
  });

  const [updateMenu] = useMutation(UPDATE_MOBILE_MENU_MUTATION);
  const [deleteMenu] = useMutation(DELETE_MOBILE_MENU_MUTATION);

  const menus = data?.mobileMenus ?? [];
  const tree = buildMenuTree(menus);

  function openCreateForm(parentId: string | null): void {
    setEditing(null);
    setPresetParentId(parentId);
    setStatus(null);
    setFormOpen(true);
  }

  function openEditForm(menu: MobileMenuData): void {
    setEditing(menu);
    setPresetParentId(null);
    setStatus(null);
    setFormOpen(true);
  }

  async function persistOrder(
    first: { id: string; orderNo: number },
    second: { id: string; orderNo: number },
  ): Promise<void> {
    setBusy(true);
    try {
      await updateMenu({
        variables: { input: first },
        refetchQueries: [MOBILE_MENUS_QUERY],
        awaitRefetchQueries: true,
      });
      await updateMenu({
        variables: { input: second },
        refetchQueries: [MOBILE_MENUS_QUERY],
        awaitRefetchQueries: true,
      });
    } catch (err: unknown) {
      setStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal mengubah urutan menu."),
      });
    } finally {
      setBusy(false);
    }
  }

  /** Tukar orderNo dengan sibling sebelum/sesudah dalam parent yang sama. */
  function handleMove(node: MenuTreeNode, direction: -1 | 1): void {
    const siblings = findSiblings(tree, node.menu.id);
    const index = siblings.findIndex((s) => s.menu.id === node.menu.id);
    const target = siblings[index + direction];
    if (target === undefined) return;
    void persistOrder(
      { id: node.menu.id, orderNo: target.menu.orderNo },
      { id: target.menu.id, orderNo: node.menu.orderNo },
    );
  }

  async function handleToggle(menu: MobileMenuData): Promise<void> {
    const action = menu.isActive ? "menonaktifkan" : "mengaktifkan";
    if (!window.confirm(`Anda yakin ingin ${action} menu "${menu.name}"?`)) {
      return;
    }
    setBusy(true);
    try {
      await updateMenu({
        variables: { input: { id: menu.id, isActive: !menu.isActive } },
        refetchQueries: [MOBILE_MENUS_QUERY],
        awaitRefetchQueries: true,
      });
      setStatus({
        kind: "sukses",
        text: `Menu "${menu.name}" ${menu.isActive ? "dinonaktifkan" : "diaktifkan"}.`,
      });
    } catch (err: unknown) {
      setStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal mengubah status menu."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(menu: MobileMenuData): Promise<void> {
    if (
      !window.confirm(`Hapus menu "${menu.name}"? Submenu tidak ikut terhapus.`)
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteMenu({
        variables: { id: menu.id },
        refetchQueries: [MOBILE_MENUS_QUERY],
        awaitRefetchQueries: true,
      });
      setStatus({ kind: "sukses", text: `Menu "${menu.name}" dihapus.` });
    } catch (err: unknown) {
      setStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal menghapus menu."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Menu Mobile"
        description="Struktur navigasi aplikasi mobile untuk aplikasi ini"
        actions={
          canCreate && contextReady ? (
            <Button
              type="button"
              className="min-h-11"
              onClick={() => openCreateForm(null)}
            >
              Tambah menu
            </Button>
          ) : undefined
        }
      />
      {!ready && <LoadingState />}
      {ready && !canView && (
        <EmptyState>
          Anda tidak memiliki izin untuk melihat menu mobile aplikasi ini.
        </EmptyState>
      )}
      {ready && canView && (
        <>
          {!contextReady && <LoadingState>Menyiapkan konteks…</LoadingState>}
          {contextReady && (
            <>
              {status && (
                <p
                  className={
                    status.kind === "sukses"
                      ? "mt-4 text-sm text-emerald-700"
                      : "mt-4 text-sm text-destructive"
                  }
                >
                  {status.text}
                </p>
              )}

              {formOpen && (
                <MenuForm
                  key={editing ? `edit-${editing.id}` : `baru-${presetParentId ?? "root"}`}
                  menus={menus}
                  editing={editing}
                  presetParentId={presetParentId}
                  onCancel={() => setFormOpen(false)}
                  onDone={(next) => {
                    setStatus(next);
                    if (next.kind === "sukses") setFormOpen(false);
                  }}
                />
              )}

              {loading && <LoadingState />}
              {error && (
                <ErrorState onRetry={() => void refetch()}>
                  {graphQLErrorMessage(error, "Gagal memuat menu mobile.")}
                </ErrorState>
              )}
              {data && menus.length === 0 && (
                <EmptyState>
                  Belum ada menu mobile. Tambah menu pertama untuk aplikasi
                  ini; strukturnya akan dikirim ke klien mobile yang aktif.
                </EmptyState>
              )}
              {data && menus.length > 0 && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Pohon menu</CardTitle>
                    <CardDescription>
                      Hierarki dan urutan yang dikonfigurasi untuk aplikasi
                      ini.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col">
                      {tree.map((node) => (
                        <MenuRow
                          key={node.menu.id}
                          node={node}
                          depth={0}
                          canCreate={canCreate}
                          canUpdate={canUpdate}
                          canDelete={canDelete}
                          busy={busy}
                          onEdit={openEditForm}
                          onAddChild={(parentId) => openCreateForm(parentId)}
                          onToggle={(menu) => void handleToggle(menu)}
                          onDelete={(menu) => void handleDelete(menu)}
                          onMove={handleMove}
                        />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

/** Cari array sibling (akar atau anak parent yang sama) dari menu ber-id. */
function findSiblings(
  tree: MenuTreeNode[],
  menuId: string,
): MenuTreeNode[] {
  for (const node of tree) {
    if (node.menu.id === menuId) return tree;
    const inChildren = findSiblings(node.children, menuId);
    if (inChildren.length > 0) return inChildren;
  }
  return [];
}
