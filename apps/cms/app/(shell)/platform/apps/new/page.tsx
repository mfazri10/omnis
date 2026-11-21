"use client";

import { useMutation } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent, JSX } from "react";
import { graphQLErrorMessage } from "../../../../../features/rbac/graphql/errors";
import { PROVISION_APP_MUTATION } from "../../../../../features/apps/graphql/apps.graphql";

const inputClass = "border border-slate-300 px-3 py-2 text-slate-900";
const primaryButtonClass =
  "min-h-[44px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondaryButtonClass =
  "min-h-[44px] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50";

// Sama dengan validasi ProvisioningService: slug → nama DB app_<slug>
// (maks 63 karakter), jadi slug efektif maksimal 59 karakter.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const MAX_DB_NAME_LENGTH = 63;
const MAX_SLUG_LENGTH = MAX_DB_NAME_LENGTH - "app_".length;

const STEPS = [
  "Identitas",
  "Template & modul",
  "Backend",
  "Ringkasan",
  "Provisioning",
] as const;
const REVIEW_STEP = 3;
const PROVISION_STEP = 4;

interface Choice {
  value: string;
  label: string;
  description: string;
  available: boolean;
  unavailableLabel?: string;
}

// Hanya opsi `available` yang didukung backend saat ini. Opsi lain
// ditampilkan agar arah produk terlihat, tetapi tidak bisa dipilih
// dan tidak pernah dikirim ke API.
const TEMPLATES: Choice[] = [
  {
    value: "base",
    label: "Aplikasi dasar",
    description:
      "Database berisi pengguna, media, dan token perangkat, plus config awal.",
    available: true,
  },
  {
    value: "cbt",
    label: "CBT / Tes CPNS",
    description: "Soal, ujian, dan hasil peserta.",
    available: false,
    unavailableLabel: "Fase 2",
  },
  {
    value: "pos",
    label: "POS / Ngewarung",
    description: "Produk, stok, dan transaksi.",
    available: false,
    unavailableLabel: "Fase 2",
  },
  {
    value: "debat",
    label: "Debat",
    description: "Mosi dan sesi debat.",
    available: false,
    unavailableLabel: "Fase 2",
  },
];

const BACKENDS: Choice[] = [
  {
    value: "shared-nestjs",
    label: "NestJS bersama",
    description:
      "Memakai API platform ini. Tidak ada backend baru yang perlu di-deploy.",
    available: true,
  },
  {
    value: "dedicated-nestjs",
    label: "NestJS terpisah",
    description: "Proyek backend sendiri khusus untuk aplikasi ini.",
    available: false,
    unavailableLabel: "Belum tersedia",
  },
  {
    value: "dedicated-go",
    label: "Go terpisah",
    description: "Proyek backend Go khusus untuk aplikasi ini.",
    available: false,
    unavailableLabel: "Belum tersedia",
  },
];

// Urutan tahap di ProvisioningService. Server belum melaporkan progres
// per tahap, jadi UI hanya menampilkan urutannya, bukan posisi aktual.
const PROVISION_STAGES = [
  "Mencatat aplikasi di registry",
  "Membuat database aplikasi",
  "Menjalankan migrasi template",
  "Menyiapkan config awal",
  "Mengaktifkan aplikasi",
];

type ProvisionStatus = "idle" | "running" | "success" | "failed";

function toDbName(slug: string): string {
  return `app_${slug.replace(/-/g, "_")}`;
}

function slugFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

function identityError(name: string, slug: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") {
    return "Nama aplikasi wajib diisi.";
  }
  if (trimmed.length > 255) {
    return "Nama aplikasi maksimal 255 karakter.";
  }
  if (!SLUG_PATTERN.test(slug)) {
    return "Slug hanya boleh huruf kecil, angka, dan strip, tidak diawali atau diakhiri strip, minimal 3 karakter.";
  }
  if (toDbName(slug).length > MAX_DB_NAME_LENGTH) {
    return `Slug maksimal ${MAX_SLUG_LENGTH} karakter agar nama database muat.`;
  }
  return null;
}

function labelOf(choices: Choice[], value: string): string {
  return choices.find((choice) => choice.value === value)?.label ?? value;
}

function StepIndicator({
  current,
  canJumpTo,
  onJump,
}: {
  current: number;
  canJumpTo: (index: number) => boolean;
  onJump: (index: number) => void;
}): JSX.Element {
  return (
    <ol className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {STEPS.map((label, index) => {
        const isCurrent = index === current;
        const isDone = index < current;
        const textClass = isCurrent
          ? "font-semibold text-slate-900"
          : isDone
            ? "text-slate-900"
            : "text-slate-500";
        const content = (
          <>
            <span aria-hidden="true">{isDone ? "✓" : `${index + 1}.`}</span>{" "}
            {label}
          </>
        );
        return (
          <li key={label} aria-current={isCurrent ? "step" : undefined}>
            {canJumpTo(index) ? (
              <button
                type="button"
                onClick={() => onJump(index)}
                className={`${textClass} underline`}
              >
                {content}
              </button>
            ) : (
              <span className={textClass}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ChoiceGroup({
  legend,
  name,
  choices,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-semibold text-slate-900">
        {legend}
      </legend>
      {choices.map((choice) => {
        const selected = choice.value === value;
        const borderClass = selected ? "border-slate-900" : "border-slate-200";
        const stateClass = choice.available
          ? "cursor-pointer"
          : "cursor-not-allowed opacity-60";
        return (
          <label
            key={choice.value}
            className={`flex gap-3 border p-4 text-sm ${borderClass} ${stateClass}`}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={selected}
              disabled={!choice.available}
              onChange={() => onChange(choice.value)}
              className="mt-1"
            />
            <span className="flex flex-col gap-1">
              <span className="font-semibold text-slate-900">
                {choice.label}
                {!choice.available && choice.unavailableLabel && (
                  <span className="ml-2 text-xs font-normal text-slate-600">
                    {choice.unavailableLabel}
                  </span>
                )}
              </span>
              <span className="text-slate-600">{choice.description}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export default function NewAppPage(): JSX.Element {
  const router = useRouter();
  const [provisionApp] = useMutation(PROVISION_APP_MUTATION);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [notes, setNotes] = useState("");
  const [template, setTemplate] = useState("base");
  const [backend, setBackend] = useState("shared-nestjs");
  const [stepError, setStepError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProvisionStatus>("idle");
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  // Kunci sinkron: state status baru berlaku di render berikutnya,
  // jadi klik/Enter ganda bisa memicu dua provisioning untuk slug sama.
  const submittingRef = useRef(false);

  const locked = status !== "idle";

  function goTo(index: number): void {
    setStepError(null);
    setStep(index);
  }

  function goNext(): void {
    if (step === 0) {
      const error = identityError(name, slug);
      if (error) {
        setStepError(error);
        return;
      }
    }
    goTo(Math.min(step + 1, REVIEW_STEP));
  }

  async function startProvisioning(): Promise<void> {
    const error = identityError(name, slug);
    if (error) {
      setStep(0);
      setStepError(error);
      return;
    }
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setStep(PROVISION_STEP);
    setStatus("running");
    setProvisionError(null);
    try {
      // template & backend belum dikirim: API saat ini hanya mendukung
      // "Aplikasi dasar" + "NestJS bersama" dan menolak modul domain.
      const result = await provisionApp({
        variables: {
          input: {
            name: name.trim(),
            slug,
            notes: notes.trim() === "" ? null : notes.trim(),
          },
        },
      });
      const created = result.data?.provisionApp;
      if (!created) {
        throw new Error("Server tidak mengembalikan data aplikasi.");
      }
      setCreatedSlug(created.slug);
      if (created.status === "active") {
        setStatus("success");
      } else {
        setProvisionError(
          created.failureReason ??
            `Status aplikasi "${created.status}", belum aktif.`,
        );
        setStatus("failed");
      }
    } catch (err: unknown) {
      setProvisionError(
        graphQLErrorMessage(err, "Gagal memprovisioning aplikasi."),
      );
      setStatus("failed");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (locked) {
      return;
    }
    if (step < REVIEW_STEP) {
      goNext();
    } else {
      void startProvisioning();
    }
  }

  function resetToIdentity(): void {
    submittingRef.current = false;
    setStatus("idle");
    setProvisionError(null);
    setCreatedSlug(null);
    goTo(0);
  }

  function openDashboard(slugToOpen: string): void {
    // Muat ulang penuh agar shell mengambil ulang daftar aplikasi
    // terjangkau; navigasi client-side masih memakai daftar lama
    // sehingga aplikasi baru dianggap tak dikenal (403).
    window.location.assign(`/${slugToOpen}`);
  }

  const reviewRows: Array<{ label: string; value: string }> = [
    { label: "Nama", value: name.trim() },
    { label: "Slug", value: slug },
    { label: "Database", value: toDbName(slug) },
    { label: "Template", value: labelOf(TEMPLATES, template) },
    { label: "Modul domain", value: "Tidak ada" },
    { label: "Backend", value: labelOf(BACKENDS, backend) },
    { label: "Catatan", value: notes.trim() === "" ? "-" : notes.trim() },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 font-sans">
      <p className="text-sm text-slate-600">Platform CMS Multi-Aplikasi</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Tambah aplikasi
      </h1>

      <StepIndicator
        current={step}
        canJumpTo={(index) => !locked && index < step}
        onJump={goTo}
      />

      <form
        className="mt-8 flex flex-col gap-6"
        onSubmit={handleSubmit}
        noValidate
      >
        {step === 0 && (
          <section className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-900">Nama aplikasi</span>
              <input
                type="text"
                required
                maxLength={255}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited) {
                    setSlug(slugFromName(e.target.value));
                  }
                }}
                className={inputClass}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-900">Slug</span>
              <input
                type="text"
                required
                maxLength={MAX_SLUG_LENGTH}
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                className={inputClass}
              />
              <span className="text-slate-600">
                Dipakai di URL CMS dan nama database{" "}
                <code>{toDbName(slug || "slug")}</code>. Tidak bisa diubah
                setelah dibuat.
              </span>
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
          </section>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-6">
            <ChoiceGroup
              legend="Template aplikasi"
              name="template"
              choices={TEMPLATES}
              value={template}
              onChange={setTemplate}
            />
            <div className="text-sm">
              <p className="font-semibold text-slate-900">Modul domain</p>
              <p className="mt-1 text-slate-600">
                Belum bisa dipilih. Aplikasi dibuat tanpa modul domain sampai
                dukungan modul tersedia di Fase 2.
              </p>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <ChoiceGroup
              legend="Mode backend"
              name="backend"
              choices={BACKENDS}
              value={backend}
              onChange={setBackend}
            />
          </section>
        )}

        {step === REVIEW_STEP && (
          <section className="flex flex-col gap-4">
            <dl className="divide-y divide-slate-100 border-y border-slate-200 text-sm">
              {reviewRows.map((row) => (
                <div key={row.label} className="flex gap-4 py-3">
                  <dt className="w-32 shrink-0 text-slate-600">{row.label}</dt>
                  <dd className="break-all text-slate-900">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-slate-600">
              Setelah dijalankan, database langsung dibuat dan dimigrasi. Slug
              tidak bisa diubah lagi.
            </p>
          </section>
        )}

        {step === PROVISION_STEP && (
          <section className="flex flex-col gap-4" aria-live="polite">
            <ol className="flex flex-col gap-2 text-sm">
              {PROVISION_STAGES.map((stage) => (
                <li key={stage} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={
                      status === "success" ? "text-slate-900" : "text-slate-400"
                    }
                  >
                    {status === "success" ? "✓" : "•"}
                  </span>
                  <span
                    className={
                      status === "success" ? "text-slate-900" : "text-slate-600"
                    }
                  >
                    {stage}
                  </span>
                </li>
              ))}
            </ol>

            {status === "running" && (
              <p className="text-sm text-slate-900">
                Memprovisioning {name.trim()}… Jangan tutup halaman ini.
              </p>
            )}

            {status === "success" && createdSlug && (
              <div className="flex flex-col gap-4">
                <p className="text-sm font-semibold text-slate-900">
                  {name.trim()} aktif dan siap dikelola.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => openDashboard(createdSlug)}
                  >
                    Buka dasbor aplikasi
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() =>
                      router.push(`/platform/apps/${createdSlug}`)
                    }
                  >
                    Lihat detail aplikasi
                  </button>
                </div>
              </div>
            )}

            {status === "failed" && (
              <div className="flex flex-col gap-4">
                <p className="whitespace-pre-line text-sm text-red-700">
                  {provisionError ?? "Gagal memprovisioning aplikasi."}
                </p>
                <p className="text-sm text-slate-600">
                  Bila aplikasi sudah tercatat berstatus gagal, ulangi
                  provisioning dari halaman detailnya. Bila slug ditolak,
                  ubah datanya lalu coba lagi.
                </p>
                <div className="flex flex-wrap gap-4">
                  {createdSlug ? (
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() =>
                        router.push(`/platform/apps/${createdSlug}`)
                      }
                    >
                      Buka detail aplikasi
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => router.push("/platform/apps")}
                    >
                      Lihat daftar aplikasi
                    </button>
                  )}
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={resetToIdentity}
                  >
                    Ubah data
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {stepError && <p className="text-sm text-red-700">{stepError}</p>}

        {step <= REVIEW_STEP && (
          <div className="flex flex-wrap gap-4">
            {step > 0 && (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => goTo(step - 1)}
              >
                Kembali
              </button>
            )}
            <button type="submit" className={primaryButtonClass}>
              {step === REVIEW_STEP ? "Buat + Provisioning" : "Lanjut"}
            </button>
            <a
              className="flex min-h-[44px] items-center px-4 py-2 text-sm underline"
              href="/platform/apps"
            >
              Batal
            </a>
          </div>
        )}
      </form>
    </main>
  );
}
