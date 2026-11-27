import type { JSX, ReactNode } from "react";
import { PublicHeader, PublicFooter } from "@/features/landing/components/public-chrome";

export default function PublicLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-4 sm:px-8">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
