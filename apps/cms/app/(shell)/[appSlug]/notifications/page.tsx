"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Fragment, use, useState } from "react";
import type { FormEvent, JSX } from "react";
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
  "min-h-[44px] border border-slate-300 px-3 py-2 text-sm text-slate-900";
const LABEL_CLASS = "text-xs font-semibold text-slate-600";

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

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-slate-200 text-slate-700",
  scheduled: "bg-blue-100 text-blue-800",
  sending: "bg-amber-100 text-amber-800",
  sent: "bg-green-100 text-green-800",
  simulated: "bg-slate-200 text-slate-700",
  unknown: "bg-purple-100 text-purple-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-slate-200 text-slate-700",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function statusBadge(status: string): string {
  const color = STATUS_BADGES[status] ?? STATUS_BADGES.draft;
  return `px-2 py-1 text-xs font-semibold ${color}`;
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
          refetchQueries: [{ query: CAMPAIGNS_QUERY }],
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
          refetchQueries: [{ query: CAMPAIGNS_QUERY }],
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
    <section className="border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        {initial === null ? "Buat kampanye" : `Ubah kampanye: ${initial.title}`}
      </h2>
      <form
        className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className={LABEL_CLASS}>Judul (wajib)</span>
          <input
            type="text"
            required
            value={title}
            maxLength={255}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul notifikasi"
            className={CONTROL_CLASS}
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
            <button
              type="button"
              disabled={saving}
              onClick={() => setPickerOpen(true)}
              className="min-h-[44px] border border-slate-300 px-4 py-2 text-sm text-slate-900 disabled:opacity-50"
            >
              Pilih dari media
            </button>
            {imageUrl.trim() !== "" && (
              <button
                type="button"
                disabled={saving}
                onClick={() => setImageUrl("")}
                className="min-h-[44px] px-2 py-2 text-sm text-red-700 underline disabled:opacity-50"
              >
                Hapus gambar
              </button>
            )}
          </div>
          {imageUrl.trim() !== "" && (
            <img
              src={imageUrl}
              alt=""
              width={160}
              height={90}
              className="mt-1 h-auto w-40 border border-slate-200 object-cover"
            />
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Target halaman (opsional)</span>
          <input
            type="text"
            value={linkTarget}
            maxLength={512}
            disabled={saving}
            onChange={(e) => setLinkTarget(e.target.value)}
            placeholder="Contoh: /promo/ramadan"
            className={CONTROL_CLASS}
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
            <input
              type="number"
              min={1}
              step={1}
              value={lastActiveDays}
              disabled={saving}
              onChange={(e) => setLastActiveDays(e.target.value)}
              placeholder="Contoh: 30"
              className={CONTROL_CLASS}
            />
          </label>
        )}
        <p className="text-xs text-slate-600 md:col-span-2">
          Kosongkan jadwal untuk menyimpan sebagai draf. Kampanye terjadwal
          dikirim otomatis pada waktunya; draf hanya terkirim lewat aksi
          Kirim sekarang.
        </p>
        <div className="flex gap-2 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="min-h-[44px] border border-slate-300 px-4 py-2 text-sm text-slate-900 disabled:opacity-50"
          >
            Batal
          </button>
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
        <dd className="mt-1 whitespace-pre-wrap text-slate-900">
          {campaign.body}
        </dd>
      </div>
      <div>
        <dt className={LABEL_CLASS}>Audiens</dt>
        <dd className="mt-1 text-slate-900">{audienceLabel(campaign)}</dd>
      </div>
      <div>
        <dt className={LABEL_CLASS}>Target halaman</dt>
        <dd className="mt-1 text-slate-900">{campaign.linkTarget ?? "–"}</dd>
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
              className="h-auto w-full max-w-xs border border-slate-200 object-cover"
            />
          </dd>
        </div>
      )}
      <div>
        <dt className={LABEL_CLASS}>Hasil pengiriman</dt>
        <dd className="mt-1 text-slate-900">{resultLabel(campaign)}</dd>
      </div>
      <div>
        <dt className={LABEL_CLASS}>Terkirim pada</dt>
        <dd className="mt-1 text-slate-900">
          {formatDateTime(campaign.sentAt)}
        </dd>
      </div>
      <div>
        <dt className={LABEL_CLASS}>Dibuat pada</dt>
        <dd className="mt-1 text-slate-900">
          {formatDateTime(campaign.createdAt)}
        </dd>
      </div>
      <div>
        <dt className={LABEL_CLASS}>Diubah pada</dt>
        <dd className="mt-1 text-slate-900">
          {formatDateTime(campaign.updatedAt)}
        </dd>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        refetchQueries: [{ query: CAMPAIGNS_QUERY }],
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
        refetchQueries: [{ query: CAMPAIGNS_QUERY }],
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

  const total = data?.campaigns.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Notifikasi {appSlug}</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Kampanye notifikasi
      </h1>
      {!ready && <p className="mt-6 text-slate-900">Memuat…</p>}
      {ready && !canView && (
        <p className="mt-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat kampanye aplikasi ini.
        </p>
      )}
      {ready && canView && (
        <>
          {!contextReady && (
            <p className="mt-6 text-slate-900">Menyiapkan konteks…</p>
          )}
          {contextReady && (
            <>
              <form
                className="mt-6 flex flex-wrap items-end gap-3"
                onSubmit={handleApply}
              >
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Pencarian</span>
                  <input
                    type="search"
                    placeholder="Cari judul…"
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
                {canSend && (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="min-h-[44px] border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    Buat kampanye
                  </button>
                )}
              </form>

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

              {loading && <p className="mt-6 text-slate-900">Memuat…</p>}
              {error && (
                <div className="mt-6">
                  <p className="text-sm text-red-700">
                    {graphQLErrorMessage(error, "Gagal memuat kampanye.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="mt-2 min-h-[44px] underline"
                  >
                    Muat ulang
                  </button>
                </div>
              )}
              {data && total === 0 && !isFiltered(applied) && (
                <p className="mt-6 text-sm text-slate-600">
                  Belum ada kampanye di aplikasi ini. Buat kampanye pertama
                  lewat tombol Buat kampanye.
                </p>
              )}
              {data && total === 0 && isFiltered(applied) && (
                <p className="mt-6 text-sm text-slate-600">
                  Tidak ada kampanye yang cocok dengan filter.
                </p>
              )}
              {data && total > 0 && (
                <>
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="py-2 pr-4 font-semibold">Judul</th>
                          <th className="py-2 pr-4 font-semibold">Status</th>
                          <th className="py-2 pr-4 font-semibold">Jadwal</th>
                          <th className="py-2 pr-4 font-semibold">Hasil</th>
                          <th className="py-2 font-semibold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.campaigns.items.map((campaign) => {
                          const expanded = expandedId === campaign.id;
                          const editable =
                            campaign.status === "draft" ||
                            campaign.status === "scheduled";
                          const cancellable =
                            campaign.status === "scheduled";
                          return (
                            <Fragment key={campaign.id}>
                              <tr className="border-b border-slate-100">
                                <td className="py-2 pr-4 font-semibold text-slate-900">
                                  {campaign.title}
                                </td>
                                <td className="py-2 pr-4">
                                  <span className={statusBadge(campaign.status)}>
                                    {statusLabel(campaign.status)}
                                  </span>
                                </td>
                                <td className="py-2 pr-4 text-slate-600">
                                  {formatDateTime(campaign.scheduledAt)}
                                </td>
                                <td className="py-2 pr-4 text-slate-600">
                                  {resultLabel(campaign)}
                                </td>
                                <td className="py-2">
                                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedId(
                                          expanded ? null : campaign.id,
                                        )
                                      }
                                      aria-expanded={expanded}
                                      className="min-h-[44px] text-sm text-slate-900 underline"
                                    >
                                      {expanded ? "Tutup" : "Detail"}
                                    </button>
                                    {canSend && editable && (
                                      <button
                                        type="button"
                                        disabled={acting}
                                        onClick={() => openEdit(campaign)}
                                        className="min-h-[44px] text-sm text-slate-900 underline disabled:opacity-50"
                                      >
                                        Ubah
                                      </button>
                                    )}
                                    {canSend && editable && (
                                      <button
                                        type="button"
                                        disabled={acting}
                                        onClick={() => void handleSend(campaign)}
                                        className="min-h-[44px] text-sm font-semibold text-slate-900 underline disabled:opacity-50"
                                      >
                                        Kirim sekarang
                                      </button>
                                    )}
                                    {canSend && cancellable && (
                                      <button
                                        type="button"
                                        disabled={acting}
                                        onClick={() =>
                                          void handleCancel(campaign)
                                        }
                                        className="min-h-[44px] text-sm text-red-700 underline disabled:opacity-50"
                                      >
                                        Batalkan
                                      </button>
                                    )}
                                  </span>
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="border-b border-slate-100 bg-slate-50">
                                  <td colSpan={5} className="px-4 py-4">
                                    <CampaignDetail campaign={campaign} />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="min-h-[44px] underline disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-slate-600">
                      {`${from}–${to} dari ${total}`}
                    </span>
                    <button
                      type="button"
                      disabled={page * PER_PAGE >= total}
                      onClick={() => setPage((p) => p + 1)}
                      className="min-h-[44px] underline disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
