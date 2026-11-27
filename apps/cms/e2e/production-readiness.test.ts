import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";

const cmsUrl = process.env.CMS_TEST_URL ?? "http://127.0.0.1:3001";
const adminEmail = process.env.BROWSER_TEST_EMAIL;
const adminPassword = process.env.BROWSER_TEST_PASSWORD;
const appSlug = process.env.BROWSER_TEST_APP_SLUG ?? `browser-test-${Date.now()}`;

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
  await page.waitForURL((url) => url.origin === new URL(cmsUrl).origin && url.pathname !== "/login");
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
      await page.getByLabel("Nama").fill("Browser Test");
      await page.getByLabel(/Slug/).fill(appSlug);
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Buat + Provisioning" }).click();
      await page.waitForURL(`${cmsUrl}/platform/apps/${appSlug}`);

      const appSwitcher = page.getByRole("combobox", { name: "Pilih aplikasi" });
      await appSwitcher.waitFor({ state: "visible" });
      await appSwitcher.locator(`option[value="${appSlug}"]`).waitFor({
        state: "attached",
        timeout: 3000,
      });
      await appSwitcher.selectOption(appSlug);
      await page.waitForURL(`${cmsUrl}/${appSlug}`);

      const routes = [
        { path: "/platform/dashboard", heading: "Dasbor Platform" },
        { path: "/platform/apps", heading: "Aplikasi" },
        { path: "/platform/roles", heading: "Role" },
        { path: `/${appSlug}`, heading: "Browser Test" },
        { path: `/${appSlug}/media`, heading: "Perpustakaan media" },
        { path: `/${appSlug}/notifications`, heading: "Kampanye notifikasi" },
        { path: `/${appSlug}/cbt/soal`, heading: "Bank soal" },
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

      await page.setViewportSize({ width: 390, height: 844 });
      for (const route of routes) {
        await page.goto(`${cmsUrl}${route.path}`);
        await page.waitForLoadState("networkidle");
        await Promise.all(graphQLResponseTasks.splice(0));
        const heading = page.locator("main h1");
        await heading.waitFor({ state: "visible" });
        expect((await heading.innerText()).trim()).toBe(route.heading);
      }

      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(horizontalOverflow).toBe(false);
      await page.screenshot({ path: "/tmp/cms-production-readiness-mobile.png", fullPage: true });

      expect(pageErrors).toEqual([]);
      expect(requestErrors).toEqual([]);
      expect(graphQLErrors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 60_000);
});
