import type { Db } from "../../database/database.service";
import { CbtDashboardSection } from "./cbt-dashboard.section";
import type { CbtQuestionsRepository } from "./questions.repository";

type Mocked<T> = { [K in keyof T]: jest.Mock };

const DB = {} as Db;

function loadSection(): {
  section: CbtDashboardSection;
  questions: Mocked<CbtQuestionsRepository>;
} {
  const questions = { count: jest.fn() } as unknown as Mocked<CbtQuestionsRepository>;
  return { section: new CbtDashboardSection(questions), questions };
}

describe("CbtDashboardSection", () => {
  it("menghitung soal aktif di App DB konteks", async () => {
    const { section, questions } = loadSection();
    questions.count.mockResolvedValue(12);
    const resolved = await section.resolve({ appId: "1", db: DB });
    expect(questions.count).toHaveBeenCalledWith(DB, { isActive: true });
    expect(resolved).toEqual({ value: 12, hint: "12 soal aktif" });
  });

  it("aplikasi tanpa tabel cbt (42P01) -> 0 + hint, bukan error", async () => {
    const { section, questions } = loadSection();
    questions.count.mockRejectedValue({ driverError: { code: "42P01" } });
    const resolved = await section.resolve({ appId: "1", db: DB });
    expect(resolved.value).toBe(0);
    expect(resolved.hint).toContain("belum terpasang");
  });

  it("42P01 terbungkus cause (bentuk drizzle/node-postgres) juga dikenali", async () => {
    const { section, questions } = loadSection();
    questions.count.mockRejectedValue({ cause: { code: "42P01" } });
    const resolved = await section.resolve({ appId: "1", db: DB });
    expect(resolved.value).toBe(0);
    expect(resolved.hint).toContain("belum terpasang");
  });

  it("error lain diteruskan (tidak ditelan diam-diam)", async () => {
    const { section, questions } = loadSection();
    questions.count.mockRejectedValue(new Error("koneksi putus"));
    await expect(section.resolve({ appId: "1", db: DB })).rejects.toThrow("koneksi putus");
  });
});
