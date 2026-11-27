import type { ComponentProps, JSX, ReactNode } from "react";
import Link from "next/link";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AuthPanel({ title, description, children }: {
  title: string;
  description?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 sm:px-6 sm:py-16">
      <Link href="/" className="mb-6 inline-flex min-h-11 items-center font-semibold text-primary">CMS Platform</Link>
      <section className="rounded-xl border border-border bg-card p-5 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        {children}
      </section>
    </main>
  );
}

export function AuthField({ label, id, ...props }: ComponentProps<typeof Input> & {
  id: string;
  label: string;
}): JSX.Element {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} className="min-h-11" {...props} />
    </Field>
  );
}
