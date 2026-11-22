import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Db } from "../../database/database.service";
import type { ActivityLogService } from "../platform/activity-logs/activity-log.service";
import type { CbtPackageRow } from "./entities/packages.entity";
import type { CbtQuestionRow } from "./entities/questions.entity";
import type { CbtPackagesRepository } from "./packages.repository";
import type { CbtPackagesService } from "./packages.service";
import type { CbtAuditContext } from "./questions.service";
import type { CbtQuestionsRepository } from "./questions.repository";

type Mocked<T> = { [K in keyof T]: jest.Mock };

const DB = {} as Db;
const AUDIT: CbtAuditContext = { adminId: "7", appId: "1", ip: null };

function pkg(over: Partial<CbtPackageRow> = {}): CbtPackageRow {
  return {
    id: 3,
    title: "Paket SKD 1",
    description: null,
    durationMinutes: 100,
    passingGrade: { twk: 65, tiu: 80, tkp: 166 },
    isActive: true,
    createdAt: new Date("2026-11-21T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
    ...over,
  };
}

function question(id: number, isActive = true): CbtQuestionRow {
  return {
    id,
    category: "TWK",
    stem: `Soal ${id}`,
    imageUrl: null,
    optionA: "a",
    optionB: "b",
    optionC: "c",
    optionD: "d",
    optionE: "e",
    correctOption: "A",
    tkpWeights: null,
    explanation: null,
    isActive,
    createdAt: new Date("2026-11-21T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
  };
}

async function loadService(): Promise<{
  service: CbtPackagesService;
  packages: Mocked<CbtPackagesRepository>;
  questions: Mocked<CbtQuestionsRepository>;
  activityLog: Mocked<ActivityLogService>;
}> {
  const { CbtPackagesService: Service } = await import("./packages.service");
  const packages = {
    list: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    listQuestions: jest.fn(),
    countQuestions: jest.fn(),
    replaceQuestions: jest.fn(),
  } as unknown as Mocked<CbtPackagesRepository>;
  const questions = {
    listByIds: jest.fn(),
  } as unknown as Mocked<CbtQuestionsRepository>;
  const activityLog = { record: jest.fn() } as unknown as Mocked<ActivityLogService>;
  return {
    service: new Service(packages, questions, activityLog as never),
    packages,
    questions,
    activityLog,
  };
}

describe("CbtPackagesService.create", () => {
  it("menolak passing grade negatif atau pecahan", async () => {
    const { service } = await loadService();
    await expect(
      service.create(
        { title: "Paket", passingGrade: { twk: -1, tiu: 80, tkp: 166 } },
        DB,
        AUDIT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        { title: "Paket", passingGrade: { twk: 65, tiu: 1.5, tkp: 166 } },
        DB,
        AUDIT,
      ),
    ).rejects.toThrow("Passing grade");
  });

  it("menyimpan paket valid + audit", async () => {
    const { service, packages, activityLog } = await loadService();
    packages.insert.mockResolvedValue(pkg());
    const created = await service.create(
      { title: "Paket SKD 1", passingGrade: { twk: 65, tiu: 80, tkp: 166 } },
      DB,
      AUDIT,
    );
    expect(created.id).toBe("3");
    expect(created.questionCount).toBe(0);
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "cbt_package" }),
    );
  });
});

describe("CbtPackagesService.setQuestions", () => {
  it("menolak duplikat", async () => {
    const { service, packages } = await loadService();
    packages.findById.mockResolvedValue(pkg());
    await expect(
      service.setQuestions("3", ["1", "1"], DB, AUDIT),
    ).rejects.toThrow("duplikat");
  });

  it("menolak soal tidak ditemukan atau nonaktif", async () => {
    const { service, packages, questions } = await loadService();
    packages.findById.mockResolvedValue(pkg());
    questions.listByIds.mockResolvedValue([question(1)]);
    await expect(service.setQuestions("3", ["1", "2"], DB, AUDIT)).rejects.toThrow(
      "#2 tidak ditemukan",
    );
    questions.listByIds.mockResolvedValue([question(1), question(2, false)]);
    await expect(service.setQuestions("3", ["1", "2"], DB, AUDIT)).rejects.toThrow(
      "nonaktif",
    );
  });

  it("mengganti komposisi sesuai urutan + audit", async () => {
    const { service, packages, questions, activityLog } = await loadService();
    packages.findById.mockResolvedValue(pkg());
    questions.listByIds.mockResolvedValue([question(1), question(2)]);
    packages.listQuestions.mockResolvedValue([question(2), question(1)]);
    await service.setQuestions("3", ["2", "1"], DB, AUDIT);
    expect(packages.replaceQuestions).toHaveBeenCalledWith(DB, 3, [2, 1]);
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", entityType: "cbt_package" }),
    );
  });

  it("paket tidak ditemukan -> NotFound", async () => {
    const { service, packages } = await loadService();
    packages.findById.mockResolvedValue(null);
    await expect(service.setQuestions("3", [], DB, AUDIT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
