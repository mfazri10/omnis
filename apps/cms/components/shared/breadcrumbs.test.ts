import { describe, expect, test } from "bun:test";
import { buildBreadcrumb } from "./breadcrumbs";

const APPS = [
  { slug: "tes-cpns", name: "Tes CPNS", modules: ["cbt"] },
];

describe("buildBreadcrumb", () => {
  test("rute platform: konteks Platform + label menu", () => {
    expect(buildBreadcrumb("/platform/apps", APPS)).toEqual([
      { label: "Platform", href: "/platform/pilih-aplikasi" },
      { label: "Aplikasi", href: null },
    ]);
  });

  test("rute aplikasi dengan modul cbt: nama aplikasi + label menu CBT", () => {
    expect(buildBreadcrumb("/tes-cpns/cbt/soal", APPS)).toEqual([
      { label: "Tes CPNS", href: "/tes-cpns" },
      { label: "Soal CBT", href: null },
    ]);
  });

  test("rute tanpa konteks aplikasi: konteks Platform + label statis", () => {
    expect(buildBreadcrumb("/profile/change-password", APPS)).toEqual([
      { label: "Platform", href: "/platform/pilih-aplikasi" },
      { label: "Ubah kata sandi", href: null },
    ]);
  });

  test("rute pemilih aplikasi: satu tingkat tanpa duplikasi", () => {
    expect(buildBreadcrumb("/platform/pilih-aplikasi", APPS)).toEqual([
      { label: "Pilih aplikasi", href: null },
    ]);
  });

  test("form baru platform: konteks Platform + label statis", () => {
    expect(buildBreadcrumb("/platform/apps/new", APPS)).toEqual([
      { label: "Platform", href: "/platform/pilih-aplikasi" },
      { label: "Aplikasi baru", href: null },
    ]);
  });

  test("detail admin: konteks Platform + label detail dinamis", () => {
    expect(buildBreadcrumb("/platform/admins/123", APPS)).toEqual([
      { label: "Platform", href: "/platform/pilih-aplikasi" },
      { label: "Detail admin", href: null },
    ]);
  });

  test("slug asing: tanpa breadcrumb", () => {
    expect(buildBreadcrumb("/slug-asing/users", APPS)).toEqual([]);
  });

  test("detail aplikasi platform: konteks Platform + label detail dinamis", () => {
    expect(buildBreadcrumb("/platform/apps/tes-cpns", APPS)).toEqual([
      { label: "Platform", href: "/platform/pilih-aplikasi" },
      { label: "Detail aplikasi", href: null },
    ]);
  });
});
