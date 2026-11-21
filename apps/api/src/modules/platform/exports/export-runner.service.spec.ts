import type { ConfigService } from "@nestjs/config";
import type { ExportJobRow } from "../entities/export-jobs.entity";
import type { ExportRunnerService } from "./export-runner.service";
import type { ExportsService } from "./exports.service";

type RunnerServiceLike = Pick<
  ExportsService,
  "sweep" | "claimQueued" | "executeClaimed"
>;

type Mocked<T> = { [K in keyof T]: jest.Mock };

function job(over: Partial<ExportJobRow> = {}): ExportJobRow {
  return {
    id: 7,
    requestedBy: 7,
    source: "app_users",
    status: "running",
    appSlug: "tes-cpns",
    filter: {},
    rowCount: null,
    fileName: null,
    fileSizeBytes: null,
    errorMessage: null,
    expiresAt: null,
    createdAt: new Date("2026-11-21T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
    ...over,
  };
}

async function loadRunner(
  configValues: Record<string, string | number> = {},
): Promise<{
  runner: ExportRunnerService;
  service: Mocked<RunnerServiceLike>;
}> {
  const { ExportRunnerService: Service } =
    await import("./export-runner.service");
  const service = {
    sweep: jest.fn().mockResolvedValue({ expired: 0, stale: 0 }),
    claimQueued: jest.fn(),
    executeClaimed: jest.fn(),
  } as unknown as Mocked<RunnerServiceLike>;
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const runner = new Service(
    service as unknown as ExportsService,
    config,
  );
  return { runner, service };
}

describe("ExportRunnerService.runOnce", () => {
  it("menyapu lalu mengeksekusi setiap job ter-klaim", async () => {
    const { runner, service } = await loadRunner();
    const now = new Date("2026-11-21T10:00:00.000Z");
    service.claimQueued.mockResolvedValue([job({ id: 7 }), job({ id: 8 })]);
    service.executeClaimed
      .mockResolvedValueOnce("done")
      .mockResolvedValueOnce("failed");

    const result = await runner.runOnce(now);

    expect(service.sweep).toHaveBeenCalledWith(now);
    expect(service.claimQueued).toHaveBeenCalledWith(now, 5);
    expect(service.executeClaimed).toHaveBeenNthCalledWith(1, 7);
    expect(service.executeClaimed).toHaveBeenNthCalledWith(2, 8);
    expect(result).toEqual({ claimed: 2, done: 1, failed: 1, skipped: 0 });
  });

  it("klaim kosong (kalah balapan) tidak memproses apa pun", async () => {
    const { runner, service } = await loadRunner();
    service.claimQueued.mockResolvedValue([]);

    const result = await runner.runOnce();

    expect(service.sweep).toHaveBeenCalled();
    expect(service.executeClaimed).not.toHaveBeenCalled();
    expect(result).toEqual({ claimed: 0, done: 0, failed: 0, skipped: 0 });
  });

  it("satu eksekusi yang melempar tak menghentikan sisanya", async () => {
    const { runner, service } = await loadRunner();
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      service.claimQueued.mockResolvedValue([job({ id: 7 }), job({ id: 8 })]);
      service.executeClaimed
        .mockRejectedValueOnce(new Error("DB putus"))
        .mockResolvedValueOnce("done");

      const result = await runner.runOnce();

      expect(service.executeClaimed).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ claimed: 2, done: 1, failed: 1, skipped: 0 });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("job yang dilewati dihitung skipped", async () => {
    const { runner, service } = await loadRunner();
    service.claimQueued.mockResolvedValue([job({ id: 7 })]);
    service.executeClaimed.mockResolvedValue("skipped");

    const result = await runner.runOnce();

    expect(result).toEqual({ claimed: 1, done: 0, failed: 0, skipped: 1 });
  });
});

describe("ExportRunnerService.onModuleInit", () => {
  let setIntervalSpy: jest.SpyInstance;
  let clearIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    setIntervalSpy = jest.spyOn(global, "setInterval");
    clearIntervalSpy = jest.spyOn(global, "clearInterval");
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("menjadwalkan interval sesuai konfigurasi saat aktif", async () => {
    const { runner } = await loadRunner({
      NODE_ENV: "development",
      EXPORT_RUNNER_INTERVAL_MS: 15000,
    });

    runner.onModuleInit();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      15000,
    );
    runner.onModuleDestroy();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("memakai 5 detik bila interval tak dikonfigurasi", async () => {
    const { runner } = await loadRunner({ NODE_ENV: "development" });

    runner.onModuleInit();

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      5000,
    );
    runner.onModuleDestroy();
  });

  it("mati otomatis saat NODE_ENV=test", async () => {
    const { runner } = await loadRunner({ NODE_ENV: "test" });

    runner.onModuleInit();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    runner.onModuleDestroy();
  });

  it("mati otomatis saat EXPORT_RUNNER=off", async () => {
    const { runner } = await loadRunner({
      NODE_ENV: "production",
      EXPORT_RUNNER: "off",
    });

    runner.onModuleInit();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    runner.onModuleDestroy();
  });

  it("panggilan runOnce yang tumpang tindih tidak mengklaim dua kali", async () => {
    const { runner, service } = await loadRunner();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    service.claimQueued.mockImplementation(async () => {
      await gate;
      return [];
    });

    const first = runner.runOnce();
    const second = await runner.runOnce();
    release();
    await first;

    expect(service.claimQueued).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ claimed: 0, done: 0, failed: 0, skipped: 0 });
  });
});
