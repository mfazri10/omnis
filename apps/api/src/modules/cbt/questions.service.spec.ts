import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Db } from "../../database/database.service";
import type { ActivityLogService } from "../platform/activity-logs/activity-log.service";
import type { CbtQuestionRow } from "./entities/questions.entity";
import type { CbtQuestionsRepository } from "./questions.repository";
import type {
  CbtAuditContext,
  CbtQuestionsService,
  CreateCbtQuestionData,
} from "./questions.service";

type Mocked<T> = { [K in keyof T]: jest.Mock };

const DB = {} as Db;
const AUDIT: CbtAuditContext = { adminId: "7", appId: "1", ip: "203.0.113.7" };
const WEIGHTS = { A: 1, B: 2, C: 3, D: 4, E: 5 };

function row(over: Partial<CbtQuestionRow> = {}): CbtQuestionRow {
  return {
    id: 9,
    category: "TWK",
    stem: "Ibukota Indonesia?",
    imageUrl: null,
    optionA: "Jakarta",
    optionB: "Bandung",
    optionC: "Surabaya",
    optionD: "Medan",
    optionE: "Semarang",
    correctOption: "A",
    tkpWeights: null,
    explanation: null,
    isActive: true,
    createdAt: new Date("2026-11-21T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
    ...over,
  };
}

function baseInput(): CreateCbtQuestionData {
  return {
    category: "TWK" as const,
    stem: "Ibukota Indonesia?",
    optionA: "Jakarta",
    optionB: "Bandung",
    optionC: "Surabaya",
    optionD: "Medan",
    optionE: "Semarang",
    correctOption: "A" as const,
  };
}

async function loadService(): Promise<{
  service: CbtQuestionsService;
  questions: Mocked<CbtQuestionsRepository>;
  activityLog: Mocked<ActivityLogService>;
}> {
  const { CbtQuestionsService: Service } = await import("./questions.service");
  const questions = {
    list: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    listByIds: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  } as unknown as Mocked<CbtQuestionsRepository>;
  const activityLog = { record: jest.fn() } as unknown as Mocked<ActivityLogService>;
  return {
    service: new Service(questions, activityLog as never),
    questions,
    activityLog,
  };
}

describe("CbtQuestionsService.create", () => {
  it("menolak TWK/TIU tanpa kunci jawaban", async () => {
    const { service } = await loadService();
    await expect(
      service.create({ ...baseInput(), correctOption: null }, DB, AUDIT),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ ...baseInput(), category: "TIU", correctOption: undefined }, DB, AUDIT),
    ).rejects.toThrow("kunci jawaban");
  });

  it("menolak TKP tanpa bobot lengkap 1..5", async () => {
    const { service } = await loadService();
    await expect(
      service.create(
        { ...baseInput(), category: "TKP", correctOption: null, tkpWeights: null },
        DB,
        AUDIT,
      ),
    ).rejects.toThrow("bobot");
    await expect(
      service.create(
        {
          ...baseInput(),
          category: "TKP",
          correctOption: null,
          tkpWeights: { ...WEIGHTS, A: 0 },
        },
        DB,
        AUDIT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("menolak kunci jawaban pada TKP dan bobot pada TWK/TIU", async () => {
    const { service } = await loadService();
    await expect(
      service.create(
        { ...baseInput(), category: "TKP", correctOption: "A", tkpWeights: WEIGHTS },
        DB,
        AUDIT,
      ),
    ).rejects.toThrow("Kunci jawaban hanya");
    await expect(
      service.create({ ...baseInput(), tkpWeights: WEIGHTS }, DB, AUDIT),
    ).rejects.toThrow("Bobot TKP hanya");
  });

  it("menyimpan soal valid, menormalkan kolom penilaian, dan mencatat audit", async () => {
    const { service, questions, activityLog } = await loadService();
    questions.insert.mockResolvedValue(row({ category: "TKP", correctOption: null, tkpWeights: WEIGHTS }));
    const created = await service.create(
      { ...baseInput(), category: "TKP", correctOption: null, tkpWeights: WEIGHTS },
      DB,
      AUDIT,
    );
    expect(questions.insert).toHaveBeenCalledWith(
      DB,
      expect.objectContaining({ category: "TKP", correctOption: null, tkpWeights: WEIGHTS }),
    );
    expect(created.id).toBe("9");
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "cbt_question", appId: "1" }),
    );
  });
});

describe("CbtQuestionsService.update", () => {
  it("memvalidasi gabungan nilai lama + perubahan (TWK jadi TKP wajib bobot)", async () => {
    const { service, questions } = await loadService();
    questions.findById.mockResolvedValue(row());
    await expect(
      service.update("9", { category: "TKP" }, DB, AUDIT),
    ).rejects.toThrow("bobot");
  });

  it("pindah kategori ke TKP dengan bobot mengosongkan kunci jawaban", async () => {
    const { service, questions } = await loadService();
    questions.findById.mockResolvedValue(row());
    questions.update.mockResolvedValue(row({ category: "TKP", correctOption: null, tkpWeights: WEIGHTS }));
    await service.update("9", { category: "TKP", tkpWeights: WEIGHTS }, DB, AUDIT);
    expect(questions.update).toHaveBeenCalledWith(
      DB,
      9,
      expect.objectContaining({ category: "TKP", correctOption: null, tkpWeights: WEIGHTS }),
    );
  });

  it("soal tidak ditemukan -> NotFound", async () => {
    const { service, questions } = await loadService();
    questions.findById.mockResolvedValue(null);
    await expect(service.update("9", {}, DB, AUDIT)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("CbtQuestionsService.setActive", () => {
  it("menonaktifkan soal dan mencatat audit", async () => {
    const { service, questions, activityLog } = await loadService();
    questions.findById.mockResolvedValue(row());
    questions.update.mockResolvedValue(row({ isActive: false }));
    const updated = await service.setActive("9", false, DB, AUDIT);
    expect(updated.isActive).toBe(false);
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", entityType: "cbt_question" }),
    );
  });
});
