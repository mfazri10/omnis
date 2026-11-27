import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium } from "playwright";
import type { Browser } from "playwright";

const cmsUrl = process.env.CMS_TEST_URL ?? "http://localhost:3001";
const picker = "/platform/pilih-aplikasi";
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

test("landing publik membuka login dan pemilih tetap terlindungi", async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/graphql") requests.push(request.url());
  });
  try {
    expect((await page.goto(`${cmsUrl}/`))?.ok()).toBe(true);
    expect(new URL(page.url()).pathname).toBe("/");
    await page.getByRole("main").getByRole("heading", { level: 1 }).waitFor();
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await page.getByRole("main").getByRole("link", { name: "Masuk CMS" }).click();
    await page.waitForURL(`${cmsUrl}/login`);
    await page.goto(`${cmsUrl}${picker}`);
    expect(new URL(page.url()).pathname).toBe("/login");
  } finally {
    await page.close();
  }
}, 30_000);

test("cookie sesi kedaluwarsa tetap bisa membuka form masuk", async () => {
  const page = await browser.newPage();
  try {
    await page.context().addCookies([{ name: "better-auth.session_token", value: "expired-fixture", url: cmsUrl }]);
    await page.goto(`${cmsUrl}${picker}`, { timeout: 15_000 });
    await page.getByRole("button", { name: "Masuk", exact: true }).waitFor({ timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/login");
  } finally {
    await page.close();
  }
}, 30_000);

test("form auth memberi umpan balik untuk kata sandi salah dan tautan kedaluwarsa", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${cmsUrl}/login`);
    await page.getByLabel("Email").fill("unregistered-fixture@example.test");
    await page.getByLabel("Kata sandi").fill("invalid-fixture-password");
    await page.keyboard.press("Enter");
    await page.getByRole("alert").getByText("Email atau kata sandi salah.").waitFor();
    await page.getByRole("link", { name: "Lupa kata sandi?" }).click();
    await page.getByLabel("Email").fill("unregistered-fixture@example.test");
    await page.getByRole("button", { name: "Kirim tautan" }).click();
    await page.getByRole("status").getByText(/Jika email terdaftar/).waitFor();
    await page.goto(`${cmsUrl}/reset-password?token=invalid-fixture`);
    await page.getByLabel("Kata sandi baru", { exact: true }).fill("invalid-fixture-password");
    await page.getByLabel("Konfirmasi kata sandi").fill("invalid-fixture-password");
    await page.getByRole("button", { name: "Simpan kata sandi" }).click();
    await page.getByRole("alert").getByText(/Tautan kedaluwarsa atau tidak valid/).waitFor();
  } finally {
    await page.close();
  }
}, 60_000);
