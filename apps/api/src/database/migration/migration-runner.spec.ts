import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { AppliedMigration } from "./migration-runner";
import { validateHistory } from "./migration-runner";

jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
}));

const mockReadFile = readFile as unknown as jest.Mock;
const CHECKSUM = createHash("sha256").update("isi-migrasi").digest("hex");

function applied(
  name: string,
  scope: string,
  checksum: string = CHECKSUM,
): AppliedMigration {
  return { name, checksum, scope };
}

beforeEach(() => {
  mockReadFile.mockReset();
  mockReadFile.mockResolvedValue(Buffer.from("isi-migrasi"));
});

describe("validateHistory multi-scope (F12)", () => {
  it("riwayat scope lain tidak dianggap file hilang", async () => {
    const riwayat = [applied("20261116000001_app_template_init.js", "app-template")];
    await expect(
      validateHistory("app-cbt", riwayat, ["20261121000002_app_cbt_init.js"]),
    ).resolves.toBeUndefined();
  });

  it("file scope sendiri yang hilang tetap ditolak", async () => {
    const riwayat = [applied("20261121000002_app_cbt_init.js", "app-cbt")];
    await expect(
      validateHistory("app-cbt", riwayat, []),
    ).rejects.toThrow("filenya hilang");
  });

  it("checksum berubah pada scope sendiri ditolak", async () => {
    const riwayat = [
      applied("20261121000002_app_cbt_init.js", "app-cbt", "checksum-lama"),
    ];
    await expect(
      validateHistory("app-cbt", riwayat, ["20261121000002_app_cbt_init.js"]),
    ).rejects.toThrow("Checksum mismatch");
  });

  it("sisip retroaktif pada scope sendiri ditolak", async () => {
    const riwayat = [applied("20261121000002_app_cbt_init.js", "app-cbt")];
    await expect(
      validateHistory("app-cbt", riwayat, [
        "20261120000001_app_cbt_lama.js",
        "20261121000002_app_cbt_init.js",
      ]),
    ).rejects.toThrow("lebih tua");
  });

  it("scope berbeda dengan nama lebih tua tidak memicu sisip retroaktif", async () => {
    const riwayat = [applied("20261116000001_app_template_init.js", "app-template")];
    await expect(
      validateHistory("app-cbt", riwayat, ["20261121000002_app_cbt_init.js"]),
    ).resolves.toBeUndefined();
  });
});
