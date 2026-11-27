"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { useBoundedPage } from "@/hooks/use-bounded-page";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/shared/page-state";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useMutation, useQuery } from "@apollo/client/react";
import { use, useState } from "react";
import type { FormEvent, JSX } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MediaPicker } from "../../../../components/shared/media-picker";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import {
  CAMPAIGNS_QUERY,
  CANCEL_CAMPAIGN_MUTATION,
  CREATE_CAMPAIGN_MUTATION,
  SEND_CAMPAIGN_NOW_MUTATION,
  UPDATE_CAMPAIGN_MUTATION,
} from "../../../../features/notifications/graphql/notifications.graphql";
import type {
  CampaignData,
  CampaignsFilter,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "../../../../features/notifications/graphql/notifications.graphql";
import { useSessionStore } from "../../../../stores/use-session-store";

const PER_PAGE = 20;

const CONTROL_CLASS =
  "min-h-11 max-w-full rounded-md border border-input bg-card px-3 py-2 text-sm";
const LABEL_CLASS = "text-sm font-medium text-muted-foreground";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draf",
  scheduled: "Terjadwal",
  sending: "Mengirim",
  sent: "Terkirim",
  simulated: "Simulasi",
  unknown: "Hasil tidak diketahui",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

const STATUS_TONES = new Map<string, StatusTone>([
  ["scheduled", "info"],
  ["sending", "warning"],
  ["sent", "success"],
  ["unknown", "warning"],
  ["failed", "danger"],
]);

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function formatDateTime(iso: string | null): string {
  if (iso === null) {
    return "–";
  }
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ISO → nilai input datetime-local lokal (YYYY-MM-DDTHH:mm). */
function toLocalInput(iso: string | null): string {
  if (iso === null) {
    return "";
  }
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function audienceLabel(campaign: CampaignData): string {
  if (campaign.targetType !== "segment") {
    return "Semua perangkat";
  }
  if (campaign.targetSegment === null) {
    return "Segmen (semua perangkat)";
  }
  try {
    const parsed: unknown = JSON.parse(campaign.targetSegment);
    if (typeof parsed !== "object" || parsed === null) {
      return "Segmen (semua perangkat)";
    }
    const days = (parsed as Record<string, unknown>)["last_active_days"];
    if (typeof days === "number" && Number.isInteger(days) && days > 0) {
      return `Aktif ${days} hari terakhir`;
    }
  } catch {
    return "Segmen (tak valid)";
  }
  return "Segmen (semua perangkat)";
}

function resultLabel(campaign: CampaignData): string {
  if (!['sent', 'simulated', 'unknown', 'failed'].includes(campaign.status)) {
    return "–";
  }
  return `Target ${campaign.targetCount}, terkirim ${campaign.sentCount}, simulasi ${campaign.simulatedCount}, gagal ${campaign.failedCount}, tidak diketahui ${campaign.unknownCount}`;
}

interface FilterDraft {
  search: string;
  status: string;
}

const EMPTY_FILTER: FilterDraft = { search: "", status: "" };

function isFiltered(draft: FilterDraft): boolean {
  return draft.search.trim() !== "" || draft.status !== "";
}

function toFilterInput(draft: FilterDraft): CampaignsFilter | null {
  const filter: CampaignsFilter = {};
  if (draft.search.trim() !== "") {
    filter.search = draft.search.trim();
  }
  if (draft.status !== "") {
    filter.status = draft.status;
  }
  return Object.keys(filter).length > 0 ? filter : null;
}

type StatusMessage = { kind: "sukses" | "gagal"; text: string };

interface CampaignFormProps {
  appSlug: string;
  initial: CampaignData | null;
  onDone: (status: StatusMessage) => void;
  onCancel: () => void;
}

function initialLastActiveDays(campaign: CampaignData | null): string {
  if (campaign?.targetSegment === null || campaign?.targetSegment === undefined) {
    return "";
  }
  try {
    const parsed: unknown = JSON.parse(campaign.targetSegment);
    if (typeof parsed !== "object" || parsed === null) {
      return "";
    }
    const days = (parsed as Record<string, unknown>)["last_active_days"];
    return typeof days === "number" && days > 0 ? String(days) : "";
  } catch {
    return "";
  }
}

function CampaignForm({
  appSlug,
  initial,
  onDone,
  onCancel,
}: CampaignFormProps): JSX.Element {
  const [createCampaign, { loading: creating }] = useMutation(
    CREATE_CAMPAIGN_MUTATION,
  );
  const [updateCampaign, { loading: updating }] = useMutation(
    UPDATE_CAMPAIGN_MUTATION,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [linkTarget, setLinkTarget] = useState(initial?.linkTarget ?? "");
  const [targetType, setTargetType] = useState(initial?.targetType ?? "all");
  const [lastActiveDays, setLastActiveDays] = useState(
    initialLastActiveDays(initial),
  );
  const [scheduledAt, setScheduledAt] = useState(
    toLocalInput(initial?.scheduledAt ?? null),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const saving = creating || updating;

  function buildSegment(): string | null | undefined {
    if (targetType !== "segment") {
      return initial === null ? undefined : null;
    }
    const trimmed = lastActiveDays.trim();
    if (trimmed === "") {
      return initial === null ? undefined : null;
    }
    const days = Number(trimmed);
    if (!Number.isInteger(days) || days <= 0) {
      return undefined;
    }
    return JSON.stringify({ last_active_days: days });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (title.trim() === "" || body.trim() === "") {
      onDone({ kind: "gagal", text: "Judul dan isi wajib diisi." });
      return;
    }
    if (targetType === "segment" && lastActiveDays.trim() !== "") {
      const days = Number(lastActiveDays.trim());
      if (!Number.isInteger(days) || days <= 0) {
        onDone({
          kind: "gagal",
          text: "Batas aktif segmen harus bilangan bulat positif.",
        });
        return;
      }
    }
    const segment = buildSegment();
    const isoSchedule =
      scheduledAt.trim() === ""
        ? null
        : new Date(scheduledAt).toISOString();
    try {
      if (initial === null) {
        const input: CreateCampaignInput = {
          title: title.trim(),
          body: body.trim(),
          imageUrl: nullIfEmpty(imageUrl) ?? undefined,
          linkTarget: nullIfEmpty(linkTarget) ?? undefined,
          targetType,
          targetSegment: segment ?? undefined,
          scheduledAt: isoSchedule ?? undefined,
        };
        await createCampaign({
          variables: { input },
          refetchQueries: [CAMPAIGNS_QUERY],
          awaitRefetchQueries: true,
        });
        onDone({ kind: "sukses", text: "Kampanye dibuat." });
      } else {
        const input: UpdateCampaignInput = {
          title: title.trim(),
          body: body.trim(),
          imageUrl: nullIfEmpty(imageUrl),
          linkTarget: nullIfEmpty(linkTarget),
          targetType,
          targetSegment: segment,
          scheduledAt: isoSchedule,
        };
        await updateCampaign({
          variables: { id: initial.id, input },
          refetchQueries: [CAMPAIGNS_QUERY],
          awaitRefetchQueries: true,
        });
        onDone({ kind: "sukses", text: "Perubahan kampanye tersimpan." });
      }
    } catch (err: unknown) {
      onDone({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal menyimpan kampanye."),
      });
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">
        {initial === null ? "Buat kampanye" : `Ubah kampanye: ${initial.title}`}
      </h2>
      <form
        className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className={LABEL_CLASS}>Judul (wajib)</span>
          <Input
            type="text"
            required
            value={title}
            maxLength={255}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul notifikasi"
            className="min-h-11 bg-card"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className={LABEL_CLASS}>Isi (wajib)</span>
          <textarea
            rows={3}
            required
            value={body}
            maxLength={4096}
            disabled={saving}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Isi notifikasi"
            className={CONTROL_CLASS}
          />
        </label>
        <div className="flex flex-col gap-1 md:col-span-2">
          <span className={LABEL_CLASS}>Gambar (opsional)</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => setPickerOpen(true)}
            >
              Pilih dari media
            </Button>
            {imageUrl.trim() !== "" && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-destructive underline underline-offset-4"
                disabled={saving}
                onClick={() => setImageUrl("")}
              >
                Hapus gambar
              </Button>
            )}
          </div>
          {imageUrl.trim() !== "" && (
            <img
              src={imageUrl}
              alt=""
              width={160}
              height={90}
              className="mt-1 h-auto w-40 rounded-md border border-border object-cover"
            />
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Target halaman (opsional)</span>
          <Input
            type="text"
            value={linkTarget}
            maxLength={512}
            disabled={saving}
            onChange={(e) => setLinkTarget(e.target.value)}
            placeholder="Contoh: /promo/ramadan"
            className="min-h-11 bg-card"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Jadwal (opsional)</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            disabled={saving}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={CONTROL_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Audiens</span>
          <select
            value={targetType}
            disabled={saving}
            onChange={(e) => setTargetType(e.target.value)}
            className={CONTROL_CLASS}
          >
            <option value="all">Semua perangkat</option>
            <option value="segment">Segmen</option>
          </select>
        </label>
        {targetType === "segment" && (
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Aktif dalam (hari, opsional)</span>
            <Input
              type="number"
              min={1}
              step={1}
              value={lastActiveDays}
              disabled={saving}
              onChange={(e) => setLastActiveDays(e.target.value)}
              placeholder="Contoh: 30"
              className="min-h-11 bg-card"
            />
          </label>
        )}
        <p className="text-xs text-muted-foreground md:col-span-2">
          Kosongkan jadwal untuk menyimpan sebagai draf. Kampanye terjadwal
          dikirim otomatis pada waktunya; draf hanya terkirim lewat aksi
          Kirim sekarang.
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
      <MediaPicker
        open={pickerOpen}
        appSlug={appSlug}
        onClose={() => setPickerOpen(false)}
        onSelect={(selection) => setImageUrl(selection.url)}
      />
    </section>
  );
}

function CampaignDetail({ campaign }: { campaign: CampaignData }): JSX.Element {
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
      <div className="md:col-span-2">
        <dt className={LABEL_CLASS}>Isi</dt>
        <dd className="mt-1 whitespace-pre-wrap">{campaign.body}</dd>
      </div>
      <div>
        <dt className={LABEL_CLASS}>Audiens</dt>
        <dd className="mt-1">{audienceLabel(campaign)}</dd>
      </div>
      <div>
        <dt className={LABEL_CLASS}>Target halaman</dt>
        <dd className="mt-1">{campaign.linkTarget ?? "–"}</dd>
      </div>
      {campaign.imageUrl !== null && (
        <div className="md:col-span-2">
          <dt className={LABEL_CLASS}>Gambar</dt>
          <dd className="mt-1">
            <img
              src={campaign.imageUrl}
              alt=""
              width={320}
              height={180}
              className="h-auto w-full max-w-xs rounded-md border border-border object-cover"
            />
          </dd>
        </div>
      )}
      <div>
        <dt className={LABEL_CLASS}>Hasil pengiriman</dt>
        <dd className="mt-1">{resultLabel(campaign)}</dd>
      </div>
      <div>
        <dt className={LABEL_CLASS}>Terkirim pada</dt>
        <dd className="mt-1">{formatDateTime(campaign.sentAt)}</dd>
      </div>
      <div>
        <dt className={LABEL_CLASS}>Dibuat pada</dt>
        <dd className="mt-1">{formatDateTime(campaign.createdAt)}</dd>
      </div>
      <div>
        <dt className={LABEL_CLASS}>Diubah pada</dt>
        <dd className="mt-1">{formatDateTime(campaign.updatedAt)}</dd>
      </div>
    </dl>
  );
}

export default function NotificationsPage({
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
    permissions.includes("platform.notifications.view");
  const canSend =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.notifications.send");

  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTER);
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignData | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [sendNow, { loading: sending }] = useMutation(
    SEND_CAMPAIGN_NOW_MUTATION,
  );
  const [cancelCampaign, { loading: cancelling }] = useMutation(
    CANCEL_CAMPAIGN_MUTATION,
  );
  const acting = sending || cancelling;

  const contextReady = ready && activeSlug === appSlug;
  const { data, loading, error, refetch } = useQuery(CAMPAIGNS_QUERY, {
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

  function openEdit(campaign: CampaignData): void {
    setEditing(campaign);
    setStatus(null);
    setFormOpen(true);
  }

  async function handleSend(campaign: CampaignData): Promise<void> {
    const confirmed = window.confirm(
      `Kirim kampanye "${campaign.title}" sekarang? Notifikasi langsung dikirim ke audiens.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      const result = await sendNow({
        variables: { id: campaign.id },
        refetchQueries: [CAMPAIGNS_QUERY],
        awaitRefetchQueries: true,
      });
      const sent = result.data?.sendCampaignNow;
      setStatus({
        kind: "sukses",
        text:
          sent === undefined
            ? `Kampanye "${campaign.title}" dikirim.`
            : `Kampanye "${campaign.title}" ${sent.status === "simulated" ? "disimulasikan" : "diproses"}: target ${sent.targetCount}, terkirim ${sent.sentCount}, simulasi ${sent.simulatedCount}, gagal ${sent.failedCount}, tidak diketahui ${sent.unknownCount}.`,
      });
    } catch (err: unknown) {
      setStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal mengirim kampanye."),
      });
    }
  }

  async function handleCancel(campaign: CampaignData): Promise<void> {
    const confirmed = window.confirm(
      `Batalkan kampanye terjadwal "${campaign.title}"?`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await cancelCampaign({
        variables: { id: campaign.id },
        refetchQueries: [CAMPAIGNS_QUERY],
        awaitRefetchQueries: true,
      });
      setStatus({
        kind: "sukses",
        text: `Kampanye "${campaign.title}" dibatalkan.`,
      });
    } catch (err: unknown) {
      setStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal membatalkan kampanye."),
      });
    }
  }

  const campaigns = data?.campaigns.items ?? [];
  const total = data?.campaigns.total ?? 0;
  const pageValid = useBoundedPage(page, setPage, PER_PAGE, loading ? undefined : data?.campaigns.total);
  const detail = campaigns.find((campaign) => campaign.id === detailId) ?? null;

  const columns: ColumnDef<CampaignData>[] = [
    {
      id: "title",
      header: "Judul",
      cell: ({ row: { original: campaign } }) => (
        <span className="block max-w-72 whitespace-normal font-medium wrap-anywhere">
          {campaign.title}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row: { original: campaign } }) => (
        <StatusBadge label={statusLabel(campaign.status)} tone={STATUS_TONES.get(campaign.status)} />
      ),
    },
    {
      id: "scheduledAt",
      header: "Jadwal",
      cell: ({ row: { original: campaign } }) => (
        <span className="text-muted-foreground">{formatDateTime(campaign.scheduledAt)}</span>
      ),
    },
    {
      id: "result",
      header: "Hasil",
      cell: ({ row: { original: campaign } }) => (
        <span className="max-w-96 block whitespace-normal text-muted-foreground wrap-anywhere">
          {resultLabel(campaign)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row: { original: campaign } }) => {
        const editable =
          campaign.status === "draft" || campaign.status === "scheduled";
        const cancellable = campaign.status === "scheduled";
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button
              type="button"
              variant="link"
              className="min-h-11"
              onClick={() => setDetailId(campaign.id)}
            >
              Detail
            </Button>
            {canSend && editable && (
              <Button
                type="button"
                variant="link"
                className="min-h-11"
                disabled={acting}
                onClick={() => openEdit(campaign)}
              >
                Ubah
              </Button>
            )}
            {canSend && editable && (
              <Button
                type="button"
                variant="link"
                className="min-h-11 font-semibold"
                disabled={acting}
                onClick={() => void handleSend(campaign)}
              >
                Kirim sekarang
              </Button>
            )}
            {canSend && cancellable && (
              <Button
                type="button"
                variant="link"
                className="min-h-11 text-destructive"
                disabled={acting}
                onClick={() => void handleCancel(campaign)}
              >
                Batalkan
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Kampanye notifikasi" description={appSlug} />
      {!ready && <LoadingState />}
      {ready && !canView && (
        <EmptyState>Anda tidak memiliki izin untuk melihat kampanye aplikasi ini.</EmptyState>
      )}
      {ready && canView && (
        <>
          {!contextReady && <LoadingState>Menyiapkan konteks…</LoadingState>}
          {contextReady && (
            <>
              <TableToolbar onSubmit={handleApply}>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Pencarian</span>
                  <Input
                    type="search"
                    placeholder="Cari judul…"
                    value={draft.search}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, search: e.target.value }))
                    }
                    className="min-h-11 bg-card"
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
                    <option value="draft">Draf</option>
                    <option value="scheduled">Terjadwal</option>
                    <option value="sending">Mengirim</option>
                    <option value="sent">Terkirim</option>
                    <option value="simulated">Simulasi</option>
                    <option value="unknown">Hasil tidak diketahui</option>
                    <option value="failed">Gagal</option>
                    <option value="cancelled">Dibatalkan</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button type="submit" className="min-h-11">Terapkan filter</Button>
                  <Button type="button" variant="outline" className="min-h-11" onClick={handleReset}>
                    Atur ulang
                  </Button>
                </div>
                {canSend && (
                  <Button type="button" variant="outline" className="min-h-11" onClick={openCreate}>
                    Buat kampanye
                  </Button>
                )}
              </TableToolbar>

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

              {formOpen && canSend && (
                <div className="mt-6">
                  <CampaignForm
                    key={editing ? editing.id : "baru"}
                    appSlug={appSlug}
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

              {loading && <LoadingState />}
              {error && (
                <ErrorState onRetry={() => void refetch()}>
                  {graphQLErrorMessage(error, "Gagal memuat kampanye.")}
                </ErrorState>
              )}
              {data && total === 0 && !isFiltered(applied) && (
                <EmptyState>
                  Belum ada kampanye di aplikasi ini. Buat kampanye pertama
                  lewat tombol Buat kampanye.
                </EmptyState>
              )}
              {data && total === 0 && isFiltered(applied) && (
                <EmptyState>Tidak ada kampanye yang cocok dengan filter.</EmptyState>
              )}
              {data && pageValid && (
                <div className="mt-6">
                  <DataTable
                    rows={campaigns}
                    columns={columns}
                    getRowId={(campaign) => campaign.id}
                    label="Daftar kampanye"
                    emptyMessage={isFiltered(applied) ? "Tidak ada kampanye yang cocok dengan filter." : "Belum ada kampanye di aplikasi ini."}
                    pagination={{ pageIndex: page - 1, pageSize: PER_PAGE, totalRows: total, onPageChange: (index) => setPage(index + 1) }}
                  />
                </div>
              )}

              <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
                {detail !== null && (
                  <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="wrap-anywhere">{detail.title}</DialogTitle>
                      <DialogDescription>Detail kampanye notifikasi.</DialogDescription>
                    </DialogHeader>
                    <CampaignDetail campaign={detail} />
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" className="min-h-11" />}>
                        Tutup
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                )}
              </Dialog>
            </>
          )}
        </>
      )}
    </main>
  );
}
