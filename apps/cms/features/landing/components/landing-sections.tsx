import type { JSX } from "react";
import { ButtonLink } from "@/components/shared/button-link";

const workflows = [
  { name: "Aplikasi dan akses", description: "Pilih aplikasi yang dikelola atau atur peran admin." },
  { name: "Media dan notifikasi", description: "Kelola aset aplikasi dan pantau status kampanye." },
  { name: "Modul CBT", description: "Susun soal, paket, dan sesi pada aplikasi yang memasang CBT." },
];

export function LandingHero(): JSX.Element {
  return (
    <section aria-labelledby="landing-title">
      <h1 id="landing-title" className="max-w-[18ch] text-4xl leading-[1.06] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
        Kelola banyak aplikasi dari satu CMS
      </h1>
      <p className="mt-5 max-w-[48ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
        Beralih antar aplikasi dan akses konten, notifikasi, serta modul yang tersedia untuk peran Anda.
      </p>
      <ButtonLink href="/login" className="mt-6 px-5">Masuk CMS</ButtonLink>
    </section>
  );
}

export function ProductExplanation(): JSX.Element {
  return (
    <section aria-labelledby="workflows-title" className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <h2 id="workflows-title" className="text-lg font-semibold tracking-tight">Di dalam ruang kerja</h2>
      </div>
      <dl className="divide-y divide-border">
        {workflows.map(({ name, description }) => (
          <div key={name} className="px-4 py-4 sm:px-6">
            <dt className="text-sm font-semibold">{name}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
