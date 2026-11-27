import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";

const cmsUrl = process.env.CMS_TEST_URL ?? "http://localhost:3001";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const picker = "/platform/pilih-aplikasi";
let browser: Browser;

beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${cmsUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL(`${cmsUrl}${picker}`);
}

async function graphql<T>(page: Page, query: string, variables: object): Promise<T> {
  const response = await page.request.post(`${apiUrl}/graphql`, { data: { query, variables } });
  const result = await response.json() as { data?: T; errors?: { message: string }[] };
  if (!response.ok() || !result.data || result.errors?.length) {
    throw new Error(result.errors?.map((error) => error.message).join(", ") ?? `GraphQL HTTP ${response.status()}`);
  }
  return result.data;
}

test("switcher mengikuti slug, modul dan izin milik aplikasi yang dipilih", async () => {
  const { BROWSER_TEST_EMAIL: email, BROWSER_TEST_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error("Set browser fixture credentials.");

  const admin = await browser.newPage();
  const member = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const suffix = Date.now();
  const first = { name: `CBT ${suffix}`, slug: `design-cbt-${suffix}`, modules: ["cbt"] };
  const second = { name: `Media ${suffix}`, slug: `design-media-${suffix}`, modules: [] };
  const memberEmail = `design-editor-${suffix}@example.test`;
  try {
    await signIn(admin, email, password);
    const cbt = await graphql<{ provisionApp: { id: string } }>(admin,
      "mutation($input: ProvisionAppInput!) { provisionApp(input: $input) { id } }", { input: first });
    const media = await graphql<{ provisionApp: { id: string } }>(admin,
      "mutation($input: ProvisionAppInput!) { provisionApp(input: $input) { id } }", { input: second });
    const account = await graphql<{ createAdmin: { id: string } }>(admin,
      "mutation($input: CreateAdminInput!) { createAdmin(input: $input) { id } }",
      { input: { email: memberEmail, password, name: "Editor fixture" } });

    for (const [appId, permission] of [[cbt.provisionApp.id, "cbt.questions.view"], [media.provisionApp.id, "platform.media.view"]]) {
      const role = await graphql<{ createRole: { id: string } }>(admin,
        "mutation($input: CreateRoleInput!) { createRole(input: $input) { id } }",
        { input: { name: `Editor ${appId}`, scopeType: "app", appId, permissionKeys: [permission] } });
      await graphql<{ assignRole: boolean }>(admin,
        "mutation($admin: ID!, $role: ID!, $app: ID!) { assignRole(adminId: $admin, roleId: $role, appId: $app) }",
        { admin: account.createAdmin.id, role: role.createRole.id, app: appId });
    }

    await signIn(member, memberEmail, password);
    await member.goto(`${cmsUrl}/${first.slug}/cbt/soal`);
    await member.getByRole("heading", { name: "Bank soal" }).waitFor();

    const globalRequests = Promise.all([
      "CurrentAdmin",
      "MyApps",
      "MyPermissions",
    ].map((operationName) =>
      member.waitForRequest((request) =>
        request.url().endsWith("/graphql") && request.method() === "POST" &&
        (request.postDataJSON() as { operationName?: string }).operationName === operationName)
    ));
    await member.goto(`${cmsUrl}${picker}`);
    for (const request of await globalRequests) {
      expect(request.headers()["x-app-slug"]).toBeUndefined();
    }

    await member.goto(`${cmsUrl}/${first.slug}/cbt/soal`);
    await member.getByRole("heading", { name: "Bank soal" }).waitFor();
    const routePermissionRequest = member.waitForRequest((request) =>
      request.url().endsWith("/graphql") && request.method() === "POST" &&
      (request.postDataJSON() as { operationName?: string }).operationName === "MyPermissions");
    await member.goto(`${cmsUrl}/${second.slug}/media`);
    await member.getByRole("heading", { name: "Perpustakaan media" }).waitFor();
    expect((await routePermissionRequest).headers()["x-app-slug"]).toBe(second.slug);

    await member.goto(`${cmsUrl}/${first.slug}/cbt/soal`);
    await member.getByRole("heading", { name: "Bank soal" }).waitFor();
    const nav = member.getByRole("navigation", { name: "Menu utama" });
    await nav.getByRole("link", { name: "Soal CBT" }).waitFor();
    expect(await nav.getByRole("link", { name: "Media", exact: true }).count()).toBe(0);

    const dashboardRequest = member.waitForRequest((request) =>
      request.url().endsWith("/graphql") && request.method() === "POST" &&
      (request.postDataJSON() as { operationName?: string }).operationName === "AppDashboard");
    await member.getByRole("combobox", { name: "Pilih aplikasi" }).click();
    await member.getByRole("option", { name: second.name, exact: true }).click();
    await member.getByRole("heading", { name: second.name }).waitFor();
    expect((await dashboardRequest).headers()["x-app-slug"]).toBe(second.slug);
    await nav.getByRole("link", { name: "Media", exact: true }).waitFor();
    expect(await nav.getByRole("link", { name: "Soal CBT" }).count()).toBe(0);
    expect(await nav.getByRole("link", { name: "Admin", exact: true }).count()).toBe(0);
    await member.goto(`${cmsUrl}/platform/admins`);
    await member.getByRole("heading", { name: "Anda tidak memiliki akses" }).waitFor();
  } finally {
    await admin.close();
    await member.close();
  }
}, 90_000);
