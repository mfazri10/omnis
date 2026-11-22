import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Db } from "../../database/database.service";
import type { ActivityLogService } from "../platform/activity-logs/activity-log.service";
import type { AppUsersRepository } from "../platform/app-users/app-users.repository";
import type { CbtPackageRow } from "./entities/packages.entity";
import type { CbtQuestionRow } from "./entities/questions.entity";
import type { CbtSessionRow } from "./entities/sessions.entity";
import type { CbtPackagesRepository } from "./packages.repository";
import type { CbtAuditContext } from "./questions.service";
import type { CbtSessionsRepository } from "./sessions.repository";
import type { CbtSessionsService } from "./sessions.service";

type Mocked<T> = { [K in keyof T]: jest.Mock };

const DB = {} as Db;
const AUDIT: CbtAuditContext = { adminId: "7", appId: "1", ip: null };
const WEIGHTS = { A: 1, B: 2, C: 3, D: 4, E: 5 };

function pkg(over: Partial<CbtPackageRow> = {}): CbtPackageRow {
  return {
    id: 3,
    title: "Paket SKD 1",
    description: null,
    durationMinutes: 100,
    passingGrade: { twk: 5, tiu: 5, tkp: 3 },
    isActive: true,
    createdAt: new Date("2026-11-21T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
    ...over,
  };
}

function question(id: number, over: Partial<CbtQuestionRow> = {}): CbtQuestionRow {
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
    isActive: true,
    createdAt: new Date("2026-11-21T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
    ...over,
  };
}

function session(over: Partial<CbtSessionRow> = {}): CbtSessionRow {
  return {
    id: 11,
    packageId: 3,
    appUserId: null,
    participantName: "Peserta Uji",
    status: "ongoing",
    startedAt: new Date("2026-11-21T00:00:00.000Z"),
    finishedAt: null,
    createdBy: 7,
    createdAt: new Date("2026-11-21T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
    ...over,
  };
}

const QUESTIONS = [
  question(1, { category: "TWK", correctOption: "A" }),
  question(2, { category: "TIU", correctOption: "B" }),
  question(3, { category: "TKP", correctOption: null, tkpWeights: WEIGHTS }),
];

async function loadService(): Promise<{
  service: CbtSessionsService;
  sessions: Mocked<CbtSessionsRepository>;
  packages: Mocked<CbtPackagesRepository>;
  appUsers: Mocked<AppUsersRepository>;
  activityLog: Mocked<ActivityLogService>;
}> {
  const { CbtSessionsService: Service } = await import("./sessions.service");
  const sessions = {
    list: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    insert: jest.fn(),
    markCompleted: jest.fn(),
    listAnswers: jest.fn(),
    upsertAnswers: jest.fn(),
    insertResult: jest.fn(),
    findResultBySession: jest.fn(),
    listResults: jest.fn(),
    countResults: jest.fn(),
    statsByPackage: jest.fn(),
  } as unknown as Mocked<CbtSessionsRepository>;
  const packages = {
    findById: jest.fn(),
    listQuestions: jest.fn(),
  } as unknown as Mocked<CbtPackagesRepository>;
  const appUsers = { findById: jest.fn() } as unknown as Mocked<AppUsersRepository>;
  const activityLog = { record: jest.fn() } as unknown as Mocked<ActivityLogService>;
  return {
    service: new Service(
      sessions,
      packages,
      appUsers,
      activityLog as never,
    ),
    sessions,
    packages,
    appUsers,
    activityLog,
  };
}

describe("CbtSessionsService.startSimulation", () => {
  it("menolak paket tidak ada, nonaktif, atau tanpa soal", async () => {
    const { service, packages } = await loadService();
    packages.findById.mockResolvedValue(null);
    await expect(
      service.startSimulation({ packageId: "3", participantName: "X" }, DB, AUDIT),
    ).rejects.toBeInstanceOf(NotFoundException);
    packages.findById.mockResolvedValue(pkg({ isActive: false }));
    await expect(
      service.startSimulation({ packageId: "3", participantName: "X" }, DB, AUDIT),
    ).rejects.toThrow("nonaktif");
    packages.findById.mockResolvedValue(pkg());
    packages.listQuestions.mockResolvedValue([]);
    await expect(
      service.startSimulation({ packageId: "3", participantName: "X" }, DB, AUDIT),
    ).rejects.toThrow("belum memiliki soal");
  });

  it("menolak peserta kosong dan user aplikasi nonaktif", async () => {
    const { service, packages, appUsers } = await loadService();
    packages.findById.mockResolvedValue(pkg());
    packages.listQuestions.mockResolvedValue(QUESTIONS);
    await expect(
      service.startSimulation({ packageId: "3" }, DB, AUDIT),
    ).rejects.toThrow("Peserta wajib diisi");
    appUsers.findById.mockResolvedValue({ id: 5, name: "Budi", isActive: false });
    await expect(
      service.startSimulation({ packageId: "3", appUserId: "5" }, DB, AUDIT),
    ).rejects.toThrow("nonaktif");
  });

  it("memakai nama user aplikasi sebagai snapshot peserta + audit", async () => {
    const { service, packages, appUsers, sessions, activityLog } = await loadService();
    packages.findById.mockResolvedValue(pkg());
    packages.listQuestions.mockResolvedValue(QUESTIONS);
    appUsers.findById.mockResolvedValue({ id: 5, name: "Budi Santoso", isActive: true });
    sessions.insert.mockResolvedValue(session({ appUserId: 5, participantName: "Budi Santoso" }));
    sessions.findById.mockResolvedValue(session({ appUserId: 5, participantName: "Budi Santoso" }));
    sessions.listAnswers.mockResolvedValue([]);
    sessions.findResultBySession.mockResolvedValue(null);
    const detail = await service.startSimulation(
      { packageId: "3", appUserId: "5", participantName: "Nama Lain" },
      DB,
      AUDIT,
    );
    expect(sessions.insert).toHaveBeenCalledWith(
      DB,
      expect.objectContaining({ appUserId: 5, participantName: "Budi Santoso", createdBy: 7 }),
    );
    expect(detail.session.participantName).toBe("Budi Santoso");
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "cbt_session" }),
    );
  });
});

describe("CbtSessionsService.submitAnswers", () => {
  it("menolak soal di luar paket sesi", async () => {
    const { service, sessions, packages } = await loadService();
    sessions.findById.mockResolvedValue(session());
    packages.listQuestions.mockResolvedValue(QUESTIONS);
    await expect(
      service.submitAnswers("11", [{ questionId: "99", selectedOption: "A" }], DB),
    ).rejects.toThrow("bukan bagian dari paket");
  });

  it("menolak sesi yang sudah selesai", async () => {
    const { service, sessions } = await loadService();
    sessions.findById.mockResolvedValue(session({ status: "completed" }));
    await expect(
      service.submitAnswers("11", [], DB),
    ).rejects.toThrow("sudah selesai");
  });

  it("upsert jawaban soal dalam paket", async () => {
    const { service, sessions, packages } = await loadService();
    sessions.findById.mockResolvedValue(session());
    packages.listQuestions.mockResolvedValue(QUESTIONS);
    packages.findById.mockResolvedValue(pkg());
    sessions.listAnswers.mockResolvedValue([]);
    sessions.findResultBySession.mockResolvedValue(null);
    await service.submitAnswers(
      "11",
      [{ questionId: "1", selectedOption: "A" }, { questionId: "3", selectedOption: null }],
      DB,
    );
    expect(sessions.upsertAnswers).toHaveBeenCalledWith(DB, 11, [
      { questionId: 1, selectedOption: "A" },
      { questionId: 3, selectedOption: null },
    ]);
  });
});

describe("CbtSessionsService.finish", () => {
  it("menilai otomatis, menyimpan hasil, menyelesaikan sesi, dan audit", async () => {
    const { service, sessions, packages, activityLog } = await loadService();
    sessions.findById.mockResolvedValue(session());
    packages.findById.mockResolvedValue(pkg());
    packages.listQuestions.mockResolvedValue(QUESTIONS);
    sessions.listAnswers.mockResolvedValue([
      { questionId: 1, selectedOption: "A" },
      { questionId: 2, selectedOption: "B" },
      { questionId: 3, selectedOption: "C" },
    ]);
    sessions.insertResult.mockResolvedValue({ id: 1 });
    sessions.markCompleted.mockResolvedValue(session({ status: "completed" }));
    sessions.findResultBySession.mockResolvedValue({
      id: 1,
      sessionId: 11,
      twkScore: 5,
      tiuScore: 5,
      tkpScore: 3,
      totalScore: 13,
      passed: true,
      computedAt: new Date("2026-11-21T01:00:00.000Z"),
    });
    const detail = await service.finish("11", DB, AUDIT);
    expect(sessions.insertResult).toHaveBeenCalledWith(
      DB,
      expect.objectContaining({
        sessionId: 11,
        twkScore: 5,
        tiuScore: 5,
        tkpScore: 3,
        totalScore: 13,
        passed: true,
      }),
    );
    expect(sessions.markCompleted).toHaveBeenCalled();
    expect(detail.result?.passed).toBe(true);
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "finish", entityType: "cbt_session" }),
    );
  });

  it("jawaban kosong menghasilkan skor 0 dan tidak lulus bila ambang > 0", async () => {
    const { service, sessions, packages } = await loadService();
    sessions.findById.mockResolvedValue(session());
    packages.findById.mockResolvedValue(pkg());
    packages.listQuestions.mockResolvedValue(QUESTIONS);
    sessions.listAnswers.mockResolvedValue([]);
    sessions.insertResult.mockResolvedValue({ id: 1 });
    sessions.markCompleted.mockResolvedValue(session({ status: "completed" }));
    sessions.findResultBySession.mockResolvedValue(null);
    await service.finish("11", DB, AUDIT);
    expect(sessions.insertResult).toHaveBeenCalledWith(
      DB,
      expect.objectContaining({ totalScore: 0, passed: false }),
    );
  });
});

describe("CbtSessionsService.packageStats", () => {
  it("menghitung passRate dan rata-rata; 0 bila belum ada sesi selesai", async () => {
    const { service, sessions, packages } = await loadService();
    packages.findById.mockResolvedValue(pkg());
    sessions.statsByPackage.mockResolvedValue({
      completed: 4,
      passedCount: 1,
      avgTotal: 100.5,
      avgTwk: 30,
      avgTiu: 40,
      avgTkp: 30.5,
      maxTotal: 150,
      minTotal: 60,
    });
    const stats = await service.packageStats("3", DB);
    expect(stats.passRate).toBe(25);
    expect(stats.avgTotal).toBe(100.5);
    sessions.statsByPackage.mockResolvedValue({
      completed: 0,
      passedCount: 0,
      avgTotal: null,
      avgTwk: null,
      avgTiu: null,
      avgTkp: null,
      maxTotal: null,
      minTotal: null,
    });
    const empty = await service.packageStats("3", DB);
    expect(empty.passRate).toBe(0);
    expect(empty.avgTotal).toBeNull();
  });

  it("menolak filter packageId tidak valid", async () => {
    const { service } = await loadService();
    await expect(
      service.listSessions({ filter: { packageId: Number("abc") } }, DB),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
