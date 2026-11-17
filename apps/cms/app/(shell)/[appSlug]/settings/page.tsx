"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { use, useState } from "react";
import type { FormEvent, JSX } from "react";
import type {
  AppConfigData,
  UpdateAppConfigInput,
} from "../../../../features/app-config/graphql/app-config.graphql";
import {
  APP_CONFIG_QUERY,
  UPDATE_APP_CONFIG_MUTATION,
} from "../../../../features/app-config/graphql/app-config.graphql";
import { graphQLErrorMessage } from "../../../../features/rbac/graphql/errors";
import { useSessionStore } from "../../../../stores/use-session-store";

const inputClass =
  "w-full border border-slate-300 px-3 py-2 text-slate-900 disabled:bg-slate-100 disabled:text-slate-500";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = "#1976D2";

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function PreviewRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <p className="text-sm">
      <span className="text-slate-600">{label}: </span>
      <span className="text-slate-900">{value}</span>
    </p>
  );
}

function EffectivePreview({ config }: { config: AppConfigData }): JSX.Element {
  return (
    <section className="border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        Pratinjau nilai efektif
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Nilai dari server, diperbarui setiap berhasil menyimpan.
      </p>
      <div className="mt-3 flex flex-col gap-1">
        <PreviewRow label="Nama tampil" value={config.displayName} />
        <PreviewRow label="Slug" value={config.slug} />
        <PreviewRow
          label="Ikon"
          value={config.iconMediaUrl ?? "mengikuti registry"}
        />
        {config.iconMediaUrl && (
          <img
            src={config.iconMediaUrl}
            alt={`Ikon ${config.displayName}`}
            width={40}
            height={40}
            className="mt-1 h-10 w-10 border border-slate-200 object-contain"
          />
        )}
        <PreviewRow
          label="Maintenance"
          value={config.maintenanceMode ? "aktif" : "mati"}
        />
        {config.maintenanceMessage && (
          <PreviewRow label="Pesan maintenance" value={config.maintenanceMessage} />
        )}
        <PreviewRow
          label="Versi minimum Android"
          value={config.minVersionAndroid}
        />
        <PreviewRow label="Versi minimum iOS" value={config.minVersionIos} />
        <p className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Warna primer: </span>
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 border border-slate-300"
            style={{ backgroundColor: config.themePrimaryColor }}
          />
          <span className="text-slate-900">{config.themePrimaryColor}</span>
        </p>
        <PreviewRow
          label="Email dukungan"
          value={config.supportEmail ?? "belum diisi"}
        />
        <PreviewRow
          label="WhatsApp dukungan"
          value={config.supportWhatsapp ?? "belum diisi"}
        />
      </div>
    </section>
  );
}

interface SettingsFormProps {
  config: AppConfigData;
  canManage: boolean;
  onStatus: (status: { kind: "sukses" | "gagal"; text: string }) => void;
}

function SettingsForm({
  config,
  canManage,
  onStatus,
}: SettingsFormProps): JSX.Element {
  const [saveConfig, { loading: saving }] = useMutation(
    UPDATE_APP_CONFIG_MUTATION,
  );
  const [maintenanceMode, setMaintenanceMode] = useState(
    config.maintenanceMode,
  );
  const [message, setMessage] = useState(config.maintenanceMessage ?? "");
  const [minAndroid, setMinAndroid] = useState(config.minVersionAndroid);
  const [minIos, setMinIos] = useState(config.minVersionIos);
  const [color, setColor] = useState(config.themePrimaryColor);
  const [logo, setLogo] = useState(config.logoMediaUrl ?? "");
  const [email, setEmail] = useState(config.supportEmail ?? "");
  const [whatsapp, setWhatsapp] = useState(config.supportWhatsapp ?? "");
  const disabled = !canManage || saving;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const input: UpdateAppConfigInput = {
      maintenanceMode,
      maintenanceMessage: nullIfEmpty(message),
      minVersionAndroid: minAndroid.trim(),
      minVersionIos: minIos.trim(),
      themePrimaryColor: color.trim(),
      logoMediaUrl: nullIfEmpty(logo),
      supportEmail: nullIfEmpty(email),
      supportWhatsapp: nullIfEmpty(whatsapp),
    };
    try {
      await saveConfig({
        variables: { input },
        refetchQueries: [{ query: APP_CONFIG_QUERY }],
      });
      onStatus({ kind: "sukses", text: "Pengaturan tersimpan." });
    } catch (err: unknown) {
      onStatus({
        kind: "gagal",
        text: graphQLErrorMessage(err, "Gagal menyimpan pengaturan."),
      });
    }
  }

  return (
    <form
      className="flex flex-col gap-8 text-sm"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <section>
        <h2 className="text-sm font-semibold text-slate-900">Maintenance</h2>
        <div className="mt-2 flex flex-col gap-3">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={maintenanceMode}
              disabled={disabled}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              className="h-5 w-5 accent-slate-900"
            />
            <span className="text-slate-900">
              Mode maintenance {maintenanceMode ? "aktif" : "mati"}
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-900">Pesan maintenance</span>
            <textarea
              rows={3}
              value={message}
              maxLength={500}
              disabled={disabled}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Contoh: Layanan sedang perawatan, kembali pukul 21.00."
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Versi minimum</h2>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-slate-900">Android (format 1.2.3)</span>
            <input
              type="text"
              required
              value={minAndroid}
              disabled={disabled}
              onChange={(e) => setMinAndroid(e.target.value)}
              placeholder="1.0.0"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-900">iOS (format 1.2.3)</span>
            <input
              type="text"
              required
              value={minIos}
              disabled={disabled}
              onChange={(e) => setMinIos(e.target.value)}
              placeholder="1.0.0"
              className={inputClass}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <PreviewRow
            label="URL store Android"
            value={config.storeUrlAndroid ?? "belum diisi di registry"}
          />
          <PreviewRow
            label="URL store iOS"
            value={config.storeUrlIos ?? "belum diisi di registry"}
          />
          <p className="text-sm text-slate-600">
            URL store dikelola di registry aplikasi, tidak diubah dari sini.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Identitas</h2>
        <div className="mt-2 flex flex-col gap-3">
          <PreviewRow label="Nama tampil" value={config.displayName} />
          <p className="text-sm text-slate-600">
            Nama tampil berasal dari registry dan tidak diubah dari sini.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-slate-900">URL logo (http/https)</span>
            <input
              type="url"
              value={logo}
              maxLength={512}
              disabled={disabled}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
          </label>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="theme-primary-color"
              className="text-slate-900"
            >
              Warna primer (hex, contoh #1976D2)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Pilih warna primer"
                value={HEX_COLOR.test(color) ? color : DEFAULT_COLOR}
                disabled={disabled}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 cursor-pointer border border-slate-300 bg-white p-1 disabled:cursor-not-allowed"
              />
              <input
                id="theme-primary-color"
                type="text"
                required
                value={color}
                disabled={disabled}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#1976D2"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">
          Kontak dukungan
        </h2>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-slate-900">Email</span>
            <input
              type="email"
              value={email}
              disabled={disabled}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dukungan@contoh.id"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-900">WhatsApp (contoh +62812…)</span>
            <input
              type="tel"
              value={whatsapp}
              disabled={disabled}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+6281234567890"
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <div>
        <button
          type="submit"
          disabled={disabled}
          className="min-h-[44px] bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
        {!canManage && (
          <p className="mt-2 text-sm text-slate-600">
            Anda hanya bisa melihat pengaturan ini. Menyimpan perubahan butuh
            hak kelola konfigurasi aplikasi.
          </p>
        )}
      </div>
    </form>
  );
}

export default function AppSettingsPage({
  params,
}: {
  params: Promise<{ appSlug: string }>;
}): JSX.Element {
  const { appSlug } = use(params);
  const ready = useSessionStore((state) => state.ready);
  const admin = useSessionStore((state) => state.admin);
  const activeSlug = useSessionStore((state) => state.activeSlug);
  const permissions = useSessionStore((state) => state.permissions);
  const [status, setStatus] = useState<{
    kind: "sukses" | "gagal";
    text: string;
  } | null>(null);

  const canManage =
    admin?.isSuperAdmin === true ||
    permissions.includes("platform.app-config.manage");
  const contextReady = ready && activeSlug === appSlug;
  const { data, loading, error, refetch } = useQuery(APP_CONFIG_QUERY, {
    skip: !contextReady,
  });
  const config = data?.appConfig;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Pengaturan aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {config ? config.displayName : appSlug}
      </h1>
      {!contextReady && (
        <p className="mt-6 text-slate-900">Menyiapkan konteks…</p>
      )}
      {contextReady && loading && (
        <p className="mt-6 text-slate-900">Memuat pengaturan…</p>
      )}
      {contextReady && error && (
        <div className="mt-6">
          <p className="text-sm text-red-700">
            {graphQLErrorMessage(error, "Gagal memuat pengaturan.")}
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
      {config && (
        <div className="mt-6 flex flex-col gap-8">
          {status && (
            <p
              className={
                status.kind === "sukses"
                  ? "text-sm text-green-700"
                  : "text-sm text-red-700"
              }
            >
              {status.text}
            </p>
          )}
          <SettingsForm
            key={config.updatedAt}
            config={config}
            canManage={canManage}
            onStatus={setStatus}
          />
          <EffectivePreview config={config} />
        </div>
      )}
    </main>
  );
}
