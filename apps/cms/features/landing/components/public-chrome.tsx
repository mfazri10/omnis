import type { JSX } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/shared/button-link";

export function PublicHeader(): JSX.Element {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 border-b border-border py-3">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-semibold tracking-tight">
        <span aria-hidden="true" className="h-4 w-1 rounded-sm bg-primary" />
        CMS Platform
      </Link>
      <nav aria-label="Navigasi publik">
        <ButtonLink href="/login" variant="outline">Masuk CMS</ButtonLink>
      </nav>
    </header>
  );
}

export function PublicFooter(): JSX.Element {
  return (
    <footer className="mt-auto flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border py-6 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">CMS Platform</span>
      <span>Panel administrasi aplikasi mobile</span>
    </footer>
  );
}
