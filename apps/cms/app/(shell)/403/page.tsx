import type { JSX } from "react";
import { CMS_PICKER_PATH } from "@/features/shell/routes";

export default function ForbiddenPage(): JSX.Element {
  return (
    <main className="mx-auto max-w-xl px-6 py-8 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">
        Anda tidak memiliki akses
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Halaman ini membutuhkan hak yang tidak Anda miliki. Hubungi Super
        Admin bila Anda merasa ini keliru.
      </p>
      <a className="mt-4 inline-block text-sm underline" href={CMS_PICKER_PATH}>
        Kembali ke pemilih aplikasi
      </a>
    </main>
  );
}
