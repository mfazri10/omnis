import type { ConfigService } from "@nestjs/config";
import type { CampaignRow } from "../entities/notification-campaigns.entity";
import type { CampaignRunnerService } from "./campaign-runner.service";
import type { NotificationsService } from "./notifications.service";

type RunnerServiceLike = Pick<
  NotificationsService,
  "claimDueCampaigns" | "executeClaimedCampaign"
>;

type Mocked<T> = { [K in keyof T]: jest.Mock };

function campaign(over: Partial<CampaignRow> = {}): CampaignRow {
  return {
    id: 11,
    appId: 1,
    createdBy: 7,
    title: "Promo",
    body: "Diskon",
    imageUrl: null,
    linkTarget: null,
    targetType: "all",
    targetSegment: null,
    status: "sending",
    scheduledAt: new Date("2026-11-18T00:00:00.000Z"),
    sentAt: null,
    targetCount: 0,
    sentCount: 0,
    failedCount: 0,
    simulatedCount: 0,
    unknownCount: 0,
    createdAt: new Date("2026-11-17T00:00:00.000Z"),
    updatedAt: new Date("2026-11-18T00:00:00.000Z"),
    ...over,
  };
}

async function loadRunner(
  configValues: Record<string, string | number> = {},
): Promise<{
  runner: CampaignRunnerService;
  service: Mocked<RunnerServiceLike>;
}> {
  const { CampaignRunnerService: Service } =
    await import("./campaign-runner.service");
  const service = {
    claimDueCampaigns: jest.fn(),
    executeClaimedCampaign: jest.fn(),
  } as unknown as Mocked<RunnerServiceLike>;
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const runner = new Service(
    service as unknown as NotificationsService,
    config,
  );
  return { runner, service };
}

describe("CampaignRunnerService.runOnce", () => {
  it("mengeksekusi setiap kampanye ter-klaim dan melaporkan hasilnya", async () => {
    const { runner, service } = await loadRunner();
    service.claimDueCampaigns.mockResolvedValue([
      campaign({ id: 11 }),
      campaign({ id: 12 }),
    ]);
    service.executeClaimedCampaign
      .mockResolvedValueOnce("sent")
      .mockResolvedValueOnce("failed");

    const result = await runner.runOnce();

    expect(service.executeClaimedCampaign).toHaveBeenCalledTimes(2);
    expect(service.executeClaimedCampaign).toHaveBeenNthCalledWith(1, 11);
    expect(service.executeClaimedCampaign).toHaveBeenNthCalledWith(2, 12);
    expect(result).toEqual({ claimed: 2, sent: 1, simulated: 0, unknown: 0, failed: 1, skipped: 0 });
  });

  it("tidak mengeksekusi apa pun bila tak ada kampanye jatuh tempo", async () => {
    const { runner, service } = await loadRunner();
    service.claimDueCampaigns.mockResolvedValue([]);

    const result = await runner.runOnce();

    expect(service.executeClaimedCampaign).not.toHaveBeenCalled();
    expect(result).toEqual({ claimed: 0, sent: 0, simulated: 0, unknown: 0, failed: 0, skipped: 0 });
  });

  it("klaim yang kalah (kosong) tidak memproses dua kali", async () => {
    const { runner, service } = await loadRunner();
    service.claimDueCampaigns.mockResolvedValue([campaign({ id: 11 })]);
    service.executeClaimedCampaign.mockResolvedValue("sent");
    await runner.runOnce();

    service.claimDueCampaigns.mockResolvedValue([]);
    const result = await runner.runOnce();

    expect(service.executeClaimedCampaign).toHaveBeenCalledTimes(1);
    expect(result.claimed).toBe(0);
  });

  it("satu eksekusi yang melempar tak menghentikan sisanya", async () => {
    const { runner, service } = await loadRunner();
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      service.claimDueCampaigns.mockResolvedValue([
        campaign({ id: 11 }),
        campaign({ id: 12 }),
      ]);
      service.executeClaimedCampaign
        .mockRejectedValueOnce(new Error("DB putus"))
        .mockResolvedValueOnce("sent");

      const result = await runner.runOnce();

      expect(service.executeClaimedCampaign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ claimed: 2, sent: 1, simulated: 0, unknown: 0, failed: 1, skipped: 0 });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("putusan tak terduga dari eksekusi dihitung gagal", async () => {
    const { runner, service } = await loadRunner();
    service.claimDueCampaigns.mockResolvedValue([campaign({ id: 11 })]);
    service.executeClaimedCampaign.mockResolvedValue("skipped");

    const result = await runner.runOnce();

    expect(result).toEqual({ claimed: 1, sent: 0, simulated: 0, unknown: 0, failed: 0, skipped: 1 });
  });
});

describe("CampaignRunnerService.onModuleInit", () => {
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
      CAMPAIGN_RUNNER_INTERVAL_MS: 15000,
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

  it("memakai 30 detik bila interval tak dikonfigurasi", async () => {
    const { runner } = await loadRunner({ NODE_ENV: "development" });

    runner.onModuleInit();

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      30000,
    );
    runner.onModuleDestroy();
  });

  it("mati otomatis saat NODE_ENV=test", async () => {
    const { runner } = await loadRunner({ NODE_ENV: "test" });

    runner.onModuleInit();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    runner.onModuleDestroy();
  });

  it("mati otomatis saat CAMPAIGN_RUNNER=off", async () => {
    const { runner } = await loadRunner({
      NODE_ENV: "production",
      CAMPAIGN_RUNNER: "off",
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
    service.claimDueCampaigns.mockImplementation(async () => {
      await gate;
      return [];
    });

    const first = runner.runOnce();
    const second = await runner.runOnce();
    release();
    await first;

    expect(service.claimDueCampaigns).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ claimed: 0, sent: 0, simulated: 0, unknown: 0, failed: 0, skipped: 0 });
  });
});
