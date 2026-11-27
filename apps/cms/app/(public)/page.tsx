import type { Metadata } from "next";
import type { JSX } from "react";
import { LandingHero, ProductExplanation } from "@/features/landing/components/landing-sections";

export const metadata: Metadata = {
  title: "CMS Platform | Pengelolaan aplikasi mobile",
  description: "Beralih antar aplikasi dan kelola akses, konten, serta modul dari satu panel admin.",
};

export default function LandingPage(): JSX.Element {
  return (
    <main className="grid items-center gap-10 py-12 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:py-20 lg:gap-20">
      <LandingHero />
      <ProductExplanation />
    </main>
  );
}
