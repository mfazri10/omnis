import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";

const cmsUrl = process.env.CMS_TEST_URL ?? "http://127.0.0.1:3001";
const adminEmail = process.env.BROWSER_TEST_EMAIL;
const adminPassword = process.env.BROWSER_TEST_PASSWORD;
const appSlug = process.env.BROWSER_TEST_APP_SLUG ?? `browser-test-${Date.now()}`;
const appName = `Aplikasi ${appSlug}`;

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
});

async function login(page: Page): Promise<void> {
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Set BROWSER_TEST_EMAIL and BROWSER_TEST_PASSWORD for the isolated admin fixture.",
    );
  }

  await page.goto(`${cmsUrl}/login`);
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Kata sandi").fill(adminPassword);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(`${cmsUrl}/platform/pilih-aplikasi`);
}

async function inspectGraphqlResponse(
  response: Awaited<ReturnType<Page["waitForResponse"]>>,
  graphQLErrors: string[],
  requestErrors: string[],
): Promise<void> {
  const requestBody = response.request().postDataJSON() as {
    operationName?: string;
  } | null;
  const operationName = requestBody?.operationName ?? "unknown operation";
  if (!response.ok()) {
    requestErrors.push(`${operationName}: GraphQL HTTP ${response.status()}`);
    return;
  }
  try {
    await response.finished();
    const body = (await response.json()) as {
      errors?: Array<{ message?: string }>;
    };
    for (const error of body.errors ?? []) {
      graphQLErrors.push(
        `${operationName}: ${error.message ?? "GraphQL error without message"}`,
      );
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "unknown JSON parse failure";
    if (message.includes("Response body is not available for a response that was navigated away from")) {
      return;
    }
    graphQLErrors.push(
      `${operationName}: HTTP ${response.status()}, ${response.headers()["content-type"] ?? "no content type"}, ${message}`,
    );
  }
}

async function exerciseCbt(page: Page): Promise<void> {
  const stem = "Soal fixture refactor";
  const title = "Paket fixture refactor";
  await page.goto(`${cmsUrl}/${appSlug}/cbt/soal`);
  await page.getByRole("button", { name: "Tambah soal" }).click();
  const questionForm = page.locator("form").filter({ has: page.getByLabel("Pertanyaan (wajib)") });
  await questionForm.getByRole("combobox", { name: "Kategori", exact: true }).selectOption("TWK");
  await questionForm.getByLabel("Pertanyaan (wajib)").fill(stem);
  for (const option of ["A", "B", "C", "D", "E"]) {
    await questionForm.getByLabel(`Opsi ${option} (wajib)`).fill(`Jawaban ${option}`);
  }
  await questionForm.getByRole("combobox", { name: "Kunci jawaban (wajib)", exact: true }).selectOption("A");
  const pickerButton = questionForm.getByRole("button", { name: "Pilih media" });
  await pickerButton.click();
  const picker = page.getByRole("dialog", { name: "Pilih media" });
  await picker.getByRole("searchbox", { name: "Cari media" }).fill("design-fixture");
  await picker.getByRole("button", { name: "Cari", exact: true }).click();
  await picker.getByRole("button", { name: /design-fixture\.png/ }).click();
  await picker.waitFor({ state: "hidden" });
  expect(await questionForm.getByLabel("Pertanyaan (wajib)").inputValue()).toBe(stem);
  await questionForm.getByRole("button", { name: "Simpan", exact: true }).click();
  await page.getByRole("row", { name: new RegExp(stem) }).waitFor();

  await page.goto(`${cmsUrl}/${appSlug}/cbt/paket`);
  await page.getByRole("button", { name: "Tambah paket" }).click();
  await page.getByLabel("Judul (wajib)").fill(title);
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  const packageRow = page.getByRole("row", { name: new RegExp(title) });
  await packageRow.getByRole("button", { name: "Komposisi" }).click();
  await page.getByRole("checkbox", { name: new RegExp(stem) }).check();
  await page.getByRole("button", { name: "Simpan komposisi" }).click();
  await page.getByText(/disimpan \(1 soal\)/).waitFor();
  page.once("dialog", (dialog) => void dialog.accept());
  await packageRow.getByRole("button", { name: "Aktifkan", exact: true }).click();
  await packageRow.getByRole("button", { name: "Nonaktifkan", exact: true }).waitFor();

  await page.goto(`${cmsUrl}/${appSlug}/cbt/sesi`);
  await page.getByRole("button", { name: "Mulai simulasi", exact: true }).click();
  await page.getByRole("combobox", { name: "Paket aktif (wajib)", exact: true }).selectOption({ label: `${title} (1 soal)` });
  await page.getByRole("radio", { name: "Nama bebas" }).check();
  await page.getByPlaceholder("Nama peserta simulasi").fill("Peserta fixture");
  await page.getByRole("button", { name: "Mulai sesi", exact: true }).click();
  await page.getByRole("radio", { name: /Jawaban A/ }).check();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Selesaikan sesi (nilai otomatis)" }).click();
  await page.getByText("Sesi sudah selesai; jawaban tidak bisa diubah.").waitFor();
  await page.goto(`${cmsUrl}/${appSlug}/cbt/hasil`);
  await page.getByRole("row", { name: /Peserta fixture/ }).waitFor();
  await page.getByRole("button", { name: /Ekspor.*CSV/ }).waitFor();
}

describe("CMS production-readiness smoke", () => {
  test("loads platform and app workflows on desktop and mobile", async () => {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const pageErrors: string[] = [];
    const requestErrors: string[] = [];
    const graphQLErrors: string[] = [];
    const graphQLResponseTasks: Promise<void>[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (request.url().includes("/graphql")) {
        requestErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`);
      }
    });
    page.on("response", (response) => {
      if (!response.url().endsWith("/graphql")) {
        return;
      }
      if (response.request().method() !== "POST") {
        return;
      }
      graphQLResponseTasks.push(
        inspectGraphqlResponse(response, graphQLErrors, requestErrors),
      );
    });

    try {
      await login(page);
      await page.waitForLoadState("networkidle");
      await Promise.all(graphQLResponseTasks.splice(0));

      await page.goto(`${cmsUrl}/platform/apps/new`);
      await page.getByRole("heading", { name: "Tambah aplikasi" }).waitFor();
      await page.getByLabel("Nama").fill(appName);
      await page.getByLabel(/Slug/).fill(appSlug);
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Buat + Provisioning" }).click();
      await page.waitForURL(`${cmsUrl}/platform/apps/${appSlug}`);

      const appSwitcher = page.getByRole("combobox", { name: "Pilih aplikasi" });
      await appSwitcher.waitFor({ state: "visible" });
      await appSwitcher.click();
      await page.getByRole("option", { name: appName, exact: true }).click();
      await page.waitForURL(`${cmsUrl}/${appSlug}`);

      const routes = [
        { path: "/platform/dashboard", heading: "Dasbor Platform" },
        { path: "/platform/apps", heading: "Aplikasi" },
        { path: "/platform/roles", heading: "Role" },
        { path: "/platform/admins", heading: "Admin" },
        { path: "/platform/audit", heading: "Audit Log" },
        { path: `/${appSlug}`, heading: appName },
        { path: `/${appSlug}/users`, heading: "Pengguna aplikasi" },
        { path: `/${appSlug}/media`, heading: "Perpustakaan media" },
        { path: `/${appSlug}/notifications`, heading: "Kampanye notifikasi" },
        { path: `/${appSlug}/cbt/soal`, heading: "Bank soal" },
        { path: `/${appSlug}/cbt/paket`, heading: "Paket ujian" },
        { path: `/${appSlug}/cbt/sesi`, heading: "Sesi ujian" },
        { path: `/${appSlug}/cbt/hasil`, heading: "Hasil & analitik" },
      ];

      for (const route of routes) {
        await page.goto(`${cmsUrl}${route.path}`);
        await page.waitForLoadState("networkidle");
        await Promise.all(graphQLResponseTasks.splice(0));
        expect(page.url()).toBe(`${cmsUrl}${route.path}`);
        const heading = page.locator("main h1");
        await heading.waitFor({ state: "visible" });
        expect((await heading.innerText()).trim()).toBe(route.heading);
      }

      await page.goto(`${cmsUrl}/${appSlug}/media`);
      const uploadTrigger = page.getByRole("button", { name: "Unggah media" });
      await uploadTrigger.click();
      const uploader = page.getByRole("dialog", { name: "Unggah media" });
      await uploader.waitFor();
      expect(await uploader.getByLabel("Berkas (wajib)").evaluate((node) => document.activeElement === node)).toBe(true);
      await page.keyboard.press("Escape");
      await uploader.waitFor({ state: "hidden" });
      await uploadTrigger.evaluate((node) => {
        if (document.activeElement !== node) throw new Error("Focus did not return to the upload button");
      });
      await uploadTrigger.click();
      await uploader.getByRole("button", { name: "Unggah", exact: true }).click();
      await uploader.getByRole("alert").getByText("Pilih berkas dulu.").waitFor();
      await uploader.getByLabel("Berkas (wajib)").setInputFiles({
        name: "design-fixture.png",
        mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ioAAAAASUVORK5CYII=", "base64"),
      });
      await uploader.getByLabel("Teks alternatif (opsional)").fill("Gambar fixture");
      await uploader.getByRole("button", { name: "Unggah", exact: true }).click();
      await uploader.waitFor({ state: "hidden" });
      await page.getByRole("img", { name: "Gambar fixture" }).waitFor();
      await exerciseCbt(page);
      await page.goto(`${cmsUrl}/${appSlug}/media`);
      await page.getByLabel("Pencarian").fill("design-fixture");
      await page.getByRole("button", { name: "Cari", exact: true }).click();
      await page.getByRole("img", { name: "Gambar fixture" }).waitFor();
      page.once("dialog", (dialog) => void dialog.accept());
      await page.getByRole("button", { name: "Hapus", exact: true }).click();
      await page.getByText("Tidak ada media yang cocok dengan pencarian.").waitFor();

      await page.goto(`${cmsUrl}/${appSlug}/notifications`);
      await page.getByRole("button", { name: "Buat kampanye" }).click();
      await page.getByLabel("Judul (wajib)").fill("Kampanye fixture");
      await page.getByLabel("Isi (wajib)").fill("Simulasi tanpa pengiriman perangkat.");
      await page.getByRole("button", { name: "Simpan", exact: true }).click();
      const campaign = page.getByRole("row", { name: /Kampanye fixture/ });
      await campaign.getByText("Draf", { exact: true }).waitFor();
      page.once("dialog", (dialog) => void dialog.accept());
      await campaign.getByRole("button", { name: "Kirim sekarang" }).click();
      await campaign.getByText("Simulasi", { exact: true }).waitFor();

      await page.goto(`${cmsUrl}/${appSlug}/settings`);
      const android = page.getByLabel(/Android \(format/);
      await android.fill("2.0.0");
      await page.getByRole("button", { name: "Simpan pengaturan" }).click();
      await page.getByText("Pengaturan tersimpan.").waitFor();
      await page.reload();
      await android.waitFor();
      expect(await android.inputValue()).toBe("2.0.0");

      await page.setViewportSize({ width: 390, height: 844 });
      for (const route of routes) {
        await page.goto(`${cmsUrl}${route.path}`);
        await page.waitForLoadState("networkidle");
        await Promise.all(graphQLResponseTasks.splice(0));
        const heading = page.locator("main h1");
        await heading.waitFor({ state: "visible" });
        expect((await heading.innerText()).trim()).toBe(route.heading);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }

      const menuButton = page.getByRole("button", { name: "Menu utama" });
      await menuButton.focus();
      await page.keyboard.press("Enter");
      const drawer = page.getByRole("dialog", { name: "Menu utama" });
      await drawer.getByRole("link", { name: "Hasil CBT" }).waitFor();
      expect(await drawer.getByRole("link", { name: "Hasil CBT" }).getAttribute("aria-current")).toBe("page");
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "hidden" });
      expect(await menuButton.evaluate((node) => document.activeElement === node)).toBe(true);
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(`${cmsUrl}/platform/admins`);
      await page.getByRole("region", { name: "Daftar admin" }).waitFor();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= 320)).toBe(true);
      await page.getByRole("searchbox", { name: "Cari admin" }).fill("tidak-ada-fixture");
      await page.getByRole("button", { name: "Cari", exact: true }).click();
      await page.getByText("Tidak ada admin yang cocok dengan pencarian.").waitFor();
      const adminPage = page.getByRole("region", { name: "Daftar admin" });
      await page.route("**/graphql", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        const request = route.request().postDataJSON() as { operationName?: string; variables?: { search?: string; skip?: number } };
        if (request.operationName !== "Admins") return route.fallback();
        const search = request.variables?.search;
        const skip = request.variables?.skip ?? 0;
        if (search === "reset halaman") expect(skip).toBe(0);
        await route.fulfill({ headers: {
          "access-control-allow-origin": cmsUrl,
          "access-control-allow-credentials": "true",
        }, json: {
          data: { admins: { totalCount: search ? 1 : 21, items: [{
            id: String(100 + skip), name: search ? "Hasil filter" : `Admin halaman ${skip ? "2" : "1"}`,
            email: "pagination-fixture@example.test", isActive: true, isSuperAdmin: false,
          }] } },
        } });
      });
      await page.reload();
      await page.getByRole("searchbox", { name: "Cari admin" }).waitFor();
      await adminPage.getByText("Admin halaman 1").waitFor();
      await page.getByRole("button", { name: "Berikutnya" }).click();
      await adminPage.getByText("Admin halaman 2").waitFor();
      await page.getByRole("searchbox", { name: "Cari admin" }).fill("reset halaman");
      await page.getByRole("button", { name: "Cari", exact: true }).click();
      await adminPage.getByText("Hasil filter").waitFor();
      await page.unroute("**/graphql");
      await page.getByRole("button", { name: "Menu utama" }).click();
      await page.getByRole("button", { name: "Akun", exact: true }).click();
      await page.getByRole("menuitem", { name: "Ubah kata sandi" }).click();
      await page.getByRole("heading", { name: "Ubah kata sandi" }).waitFor();
      await page.screenshot({ path: "/tmp/cms-production-readiness-mobile.png", fullPage: true });

      expect(pageErrors).toEqual([]);
      expect(requestErrors).toEqual([]);
      expect(graphQLErrors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 160_000);
});
