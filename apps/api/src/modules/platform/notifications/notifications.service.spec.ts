import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { Db } from "../../../database/database.service";
import type { DatabaseService } from "../../../database/database.service";
import type { ActivityLogService } from "../activity-logs/activity-log.service";
import type { AppRow } from "../entities/apps.entity";
import type { AppsRepository } from "../apps/apps.repository";
import type { CampaignRow } from "../entities/notification-campaigns.entity";
import type { DeviceTokensRepository } from "./device-tokens.repository";
import type { CampaignsRepository } from "./notifications.repository";
import type {
  CampaignAuditContext,
  CampaignItem,
  NotificationsService,
} from "./notifications.service";
import type { PushSender } from "./push-sender";

type Mocked<T> = { [K in keyof T]: jest.Mock };

const CONTROL_DB = {} as Db;
const APP_DB = {} as Db;
const AUDIT: CampaignAuditContext = { adminId: "7", ip: "203.0.113.7" };

function campaign(over: Partial<CampaignRow> = {}): CampaignRow {
  return {
    id: 11,
    appId: 1,
    createdBy: 7,
    title: "Promo Ramadan",
    body: "Diskon 50%",
    imageUrl: null,
    linkTarget: null,
    targetType: "all",
    targetSegment: null,
    status: "draft",
    scheduledAt: null,
    sentAt: null,
    targetCount: 0,
    sentCount: 0,
    failedCount: 0,
    simulatedCount: 0,
    unknownCount: 0,
    createdAt: new Date("2026-11-17T00:00:00.000Z"),
    updatedAt: new Date("2026-11-17T00:00:00.000Z"),
    ...over,
  };
}

function app(over: Partial<AppRow> = {}): AppRow {
  return {
    id: 1,
    name: "Tes CPNS",
    slug: "tes-cpns",
    iconMediaUrl: null,
    status: "active",
    dbName: "app_tes_cpns",
    androidPackage: null,
    iosBundleId: null,
    storeUrlAndroid: null,
    storeUrlIos: null,
    fcmCredential: null,
    notes: null,
    modules: [],
    failureReason: null,
    lastProvisioningAt: null,
    createdAt: new Date("2026-11-17T00:00:00.000Z"),
    updatedAt: new Date("2026-11-17T00:00:00.000Z"),
    ...over,
  };
}

async function loadService(): Promise<{
  service: NotificationsService;
  database: Mocked<DatabaseService>;
  campaigns: Mocked<CampaignsRepository>;
  tokens: Mocked<DeviceTokensRepository>;
  apps: Mocked<AppsRepository>;
  activityLog: Mocked<ActivityLogService>;
  sender: Mocked<PushSender>;
}> {
  const { NotificationsService: Service } =
    await import("./notifications.service");
  const database = {
    getControlPlaneConnection: jest.fn(() => CONTROL_DB),
    getAppConnection: jest.fn(),
  } as unknown as Mocked<DatabaseService>;
  const campaigns = {
    list: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    updateSending: jest.fn(),
    claimDueCampaigns: jest.fn(),
    claimForSend: jest.fn(),
    markStaleSendingUnknown: jest.fn(),
  } as unknown as Mocked<CampaignsRepository>;
  const tokens = {
    listTokens: jest.fn(),
    deleteByToken: jest.fn(),
  } as unknown as Mocked<DeviceTokensRepository>;
  const apps = {
    findById: jest.fn(),
  } as unknown as Mocked<AppsRepository>;
  const activityLog = {
    record: jest.fn(),
  } as unknown as Mocked<ActivityLogService>;
  const fcmCredentials = { decrypt: jest.fn((value: string) => value) };
  const sender = {
    send: jest.fn(),
    simulated: false,
  } as unknown as Mocked<PushSender>;
  const service = new Service(
    database as unknown as DatabaseService,
    campaigns,
    tokens,
    apps,
    fcmCredentials as never,
    activityLog as unknown as ActivityLogService,
    sender as unknown as PushSender,
  );
  campaigns.updateSending.mockImplementation(() =>
    Promise.resolve(campaign({ status: "sending" })),
  );
  return { service, database, campaigns, tokens, apps, activityLog, sender };
}

function futureDate(): Date {
  return new Date(Date.now() + 3600 * 1000);
}

describe("NotificationsService.list", () => {
  it("meneruskan appId + filter + pagination ke repository", async () => {
    const { service, campaigns } = await loadService();
    campaigns.list.mockResolvedValue([campaign()]);
    campaigns.count.mockResolvedValue(1);

    const result = await service.list("1", {
      filter: { status: "scheduled", search: "promo" },
      page: 2,
      perPage: 10,
    });

    expect(campaigns.list).toHaveBeenCalledWith(
      CONTROL_DB,
      { appId: 1, status: "scheduled", search: "promo" },
      { limit: 10, offset: 10 },
    );
    expect(campaigns.count).toHaveBeenCalledWith(CONTROL_DB, {
      appId: 1,
      status: "scheduled",
      search: "promo",
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe("11");
  });
});

describe("NotificationsService.getById", () => {
  it("NotFound untuk kampanye milik aplikasi lain", async () => {
    const { service, campaigns } = await loadService();
    campaigns.findById.mockResolvedValue(campaign({ appId: 2 }));

    await expect(service.getById("11", "1")).rejects.toThrow(NotFoundException);
  });

  it("mengembalikan item kampanye se-aplikasi", async () => {
    const { service, campaigns } = await loadService();
    campaigns.findById.mockResolvedValue(campaign());

    const item: CampaignItem = await service.getById("11", "1");

    expect(item.id).toBe("11");
    expect(item.appId).toBe("1");
    expect(item.title).toBe("Promo Ramadan");
  });
});

describe("NotificationsService.createCampaign", () => {
  it("NotFound bila aplikasi tak ada", async () => {
    const { service, apps, campaigns } = await loadService();
    apps.findById.mockResolvedValue(null);

    await expect(
      service.createCampaign("99", { title: "X", body: "Y" }, AUDIT),
    ).rejects.toThrow(NotFoundException);
    expect(campaigns.insert).not.toHaveBeenCalled();
  });

  it("status draft bila tanpa jadwal", async () => {
    const { service, apps, campaigns } = await loadService();
    apps.findById.mockResolvedValue(app());
    campaigns.insert.mockResolvedValue(campaign());

    await service.createCampaign("1", { title: "X", body: "Y" }, AUDIT);

    expect(campaigns.insert).toHaveBeenCalledWith(CONTROL_DB, {
      appId: 1,
      createdBy: 7,
      title: "X",
      body: "Y",
      imageUrl: null,
      linkTarget: null,
      targetType: "all",
      targetSegment: null,
      status: "draft",
      scheduledAt: null,
    });
  });

  it("status scheduled bila jadwal di masa depan", async () => {
    const { service, apps, campaigns } = await loadService();
    const scheduledAt = futureDate();
    apps.findById.mockResolvedValue(app());
    campaigns.insert.mockResolvedValue(campaign());

    await service.createCampaign(
      "1",
      { title: "X", body: "Y", scheduledAt },
      AUDIT,
    );

    expect(campaigns.insert).toHaveBeenCalledWith(
      CONTROL_DB,
      expect.objectContaining({ status: "scheduled", scheduledAt }),
    );
  });

  it("mencatat audit create dengan appId benar", async () => {
    const { service, apps, campaigns, activityLog } = await loadService();
    apps.findById.mockResolvedValue(app());
    campaigns.insert.mockResolvedValue(campaign({ id: 11 }));

    await service.createCampaign("1", { title: "X", body: "Y" }, AUDIT);

    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "7",
      appId: "1",
      action: "create",
      entityType: "notification_campaign",
      entityId: "11",
      summary: 'Membuat kampanye notifikasi "Promo Ramadan"',
      ip: "203.0.113.7",
    });
  });

  it("menolak segmen JSON yang rusak", async () => {
    const { service, apps, campaigns } = await loadService();
    apps.findById.mockResolvedValue(app());

    await expect(
      service.createCampaign(
        "1",
        { title: "X", body: "Y", targetType: "segment", targetSegment: "{rusak" },
        AUDIT,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(campaigns.insert).not.toHaveBeenCalled();
  });
});

describe("NotificationsService.updateCampaign", () => {
  it("NotFound untuk kampanye milik aplikasi lain", async () => {
    const { service, campaigns } = await loadService();
    campaigns.findById.mockResolvedValue(campaign({ appId: 2 }));

    await expect(
      service.updateCampaign("11", "1", { title: "Baru" }, AUDIT),
    ).rejects.toThrow(NotFoundException);
    expect(campaigns.update).not.toHaveBeenCalled();
  });

  it.each(["sending", "sent", "failed", "cancelled"] as const)(
    "menolak ubah saat status %s",
    async (status) => {
      const { service, campaigns } = await loadService();
      campaigns.findById.mockResolvedValue(campaign({ status }));

      await expect(
        service.updateCampaign("11", "1", { title: "Baru" }, AUDIT),
      ).rejects.toThrow(BadRequestException);
      expect(campaigns.update).not.toHaveBeenCalled();
    },
  );

  it("mengubah draf + jadwal baru menjadikannya scheduled", async () => {
    const { service, campaigns, activityLog } = await loadService();
    const scheduledAt = futureDate();
    campaigns.findById.mockResolvedValue(campaign());
    campaigns.update.mockResolvedValue(campaign({ title: "Baru" }));

    const item = await service.updateCampaign(
      "11",
      "1",
      { title: "Baru", scheduledAt },
      AUDIT,
    );

    expect(campaigns.update).toHaveBeenCalledWith(
      CONTROL_DB,
      11,
      expect.objectContaining({
        title: "Baru",
        status: "scheduled",
        scheduledAt,
      }),
    );
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", entityId: "11" }),
    );
    expect(item.title).toBe("Baru");
  });

  it("menghapus jadwal mengembalikannya ke draft", async () => {
    const { service, campaigns } = await loadService();
    campaigns.findById.mockResolvedValue(
      campaign({ status: "scheduled", scheduledAt: futureDate() }),
    );
    campaigns.update.mockResolvedValue(campaign());

    await service.updateCampaign("11", "1", { scheduledAt: null }, AUDIT);

    expect(campaigns.update).toHaveBeenCalledWith(
      CONTROL_DB,
      11,
      expect.objectContaining({ status: "draft", scheduledAt: null }),
    );
  });
});

describe("NotificationsService.sendCampaignNow", () => {
  it("menolak kirim saat status terminal", async () => {
    const { service, campaigns } = await loadService();
    campaigns.findById.mockResolvedValue(campaign({ status: "sent" }));

    await expect(service.sendCampaignNow("11", "1", AUDIT)).rejects.toThrow(
      BadRequestException,
    );
    expect(campaigns.claimForSend).not.toHaveBeenCalled();
  });

  it("Conflict bila klaim kalah balapan", async () => {
    const { service, campaigns, tokens } = await loadService();
    campaigns.findById.mockResolvedValue(campaign());
    campaigns.claimForSend.mockResolvedValue(null);

    await expect(service.sendCampaignNow("11", "1", AUDIT)).rejects.toThrow(
      ConflictException,
    );
    expect(tokens.listTokens).not.toHaveBeenCalled();
  });

  it("tanpa token tercatat sent dengan target 0, bukan error", async () => {
    const { service, campaigns, tokens, apps, activityLog, sender, database } =
      await loadService();
    campaigns.findById
      .mockResolvedValueOnce(campaign())
      .mockResolvedValueOnce(campaign({ status: "sent" }));
    campaigns.claimForSend.mockResolvedValue(campaign({ status: "sending" }));
    apps.findById.mockResolvedValue(app());
    database.getAppConnection.mockResolvedValue(APP_DB);
    tokens.listTokens.mockResolvedValue([]);
    campaigns.updateSending.mockResolvedValue(campaign({ status: "sent" }));

    const item = await service.sendCampaignNow("11", "1", AUDIT);

    expect(sender.send).not.toHaveBeenCalled();
    expect(campaigns.updateSending).toHaveBeenCalledWith(
      CONTROL_DB,
      11,
      expect.objectContaining({
        status: "sent",
        targetCount: 0,
        sentCount: 0,
        failedCount: 0,
      }),
    );
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "send", entityId: "11" }),
    );
    expect(item.status).toBe("sent");
    expect(item.targetCount).toBe(0);
  });

  it("menghitung sent/failed dari hasil sender", async () => {
    const { service, campaigns, tokens, apps, database, sender } =
      await loadService();
    campaigns.findById.mockResolvedValue(campaign());
    campaigns.claimForSend.mockResolvedValue(campaign({ status: "sending" }));
    apps.findById.mockResolvedValue(app());
    database.getAppConnection.mockResolvedValue(APP_DB);
    tokens.listTokens.mockResolvedValue([
      { id: 1, token: "token-1" },
      { id: 2, token: "token-2" },
      { id: 3, token: "token-3" },
    ]);
    sender.send
      .mockResolvedValueOnce("sent")
      .mockResolvedValueOnce("failed")
      .mockResolvedValueOnce("sent");
    campaigns.updateSending.mockResolvedValue(campaign({ status: "sent" }));

    await service.sendCampaignNow("11", "1", AUDIT);

    expect(sender.send).toHaveBeenCalledTimes(3);
    expect(campaigns.updateSending).toHaveBeenCalledWith(
      CONTROL_DB,
      11,
      expect.objectContaining({
        status: "sent",
        targetCount: 3,
        sentCount: 2,
        failedCount: 1,
      }),
    );
  });

  it("token basi dihapus dan dihitung gagal", async () => {
    const { service, campaigns, tokens, apps, database, sender } =
      await loadService();
    campaigns.findById.mockResolvedValue(campaign());
    campaigns.claimForSend.mockResolvedValue(campaign({ status: "sending" }));
    apps.findById.mockResolvedValue(app());
    database.getAppConnection.mockResolvedValue(APP_DB);
    tokens.listTokens.mockResolvedValue([{ id: 9, token: "token-basi" }]);
    sender.send.mockResolvedValue("invalid-token");
    campaigns.updateSending.mockResolvedValue(campaign({ status: "failed" }));

    await service.sendCampaignNow("11", "1", AUDIT);

    expect(tokens.deleteByToken).toHaveBeenCalledWith(APP_DB, "token-basi");
    expect(campaigns.updateSending).toHaveBeenCalledWith(
      CONTROL_DB,
      11,
      expect.objectContaining({
        status: "failed",
        targetCount: 1,
        sentCount: 0,
        failedCount: 1,
      }),
    );
  });

  it("semua gagal tanpa token basi → status failed", async () => {
    const { service, campaigns, tokens, apps, database, sender } =
      await loadService();
    campaigns.findById
      .mockResolvedValueOnce(campaign())
      .mockResolvedValueOnce(campaign({ status: "failed" }));
    campaigns.claimForSend.mockResolvedValue(campaign({ status: "sending" }));
    apps.findById.mockResolvedValue(app());
    database.getAppConnection.mockResolvedValue(APP_DB);
    tokens.listTokens.mockResolvedValue([{ id: 1, token: "token-1" }]);
    sender.send.mockResolvedValue("failed");
    campaigns.updateSending.mockResolvedValue(campaign({ status: "failed" }));

    const item = await service.sendCampaignNow("11", "1", AUDIT);

    expect(item.status).toBe("failed");
  });

  it("mengakhiri kampanye noop sebagai simulated, bukan sent", async () => {
    const { service, campaigns, tokens, apps, database, sender } = await loadService();
    Object.defineProperty(sender, "simulated", { value: true });
    campaigns.findById
      .mockResolvedValueOnce(campaign())
      .mockResolvedValueOnce(campaign({ status: "simulated" }));
    campaigns.claimForSend.mockResolvedValue(campaign({ status: "sending" }));
    apps.findById.mockResolvedValue(app());
    database.getAppConnection.mockResolvedValue(APP_DB);
    tokens.listTokens.mockResolvedValue([{ id: 1, token: "token-1" }]);
    sender.send.mockResolvedValue("simulated");
    campaigns.updateSending.mockResolvedValue(campaign({ status: "simulated" }));

    const item = await service.sendCampaignNow("11", "1", AUDIT);

    expect(item.status).toBe("simulated");
    expect(campaigns.updateSending).toHaveBeenLastCalledWith(
      CONTROL_DB,
      11,
      expect.objectContaining({ status: "simulated", sentCount: 0, simulatedCount: 1, failedCount: 0, unknownCount: 0 }),
    );
  });

  it("tidak menimpa unknown jika rekonsiliasi menang saat FCM masih berjalan", async () => {
    const { service, campaigns, tokens, apps, database, sender } = await loadService();
    campaigns.findById.mockResolvedValue(campaign({ status: "sending", targetCount: 1 }));
    apps.findById.mockResolvedValue(app());
    database.getAppConnection.mockResolvedValue(APP_DB);
    tokens.listTokens.mockResolvedValue([{ id: 1, token: "token-1" }]);
    sender.send.mockResolvedValue("sent");
    campaigns.updateSending
      .mockResolvedValueOnce(campaign({ status: "sending", targetCount: 1 }))
      .mockResolvedValueOnce(null);

    const result = await service.executeClaimedCampaign(11);

    expect(result).toBe("unknown");
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(campaigns.update).not.toHaveBeenCalled();
    expect(campaigns.updateSending).toHaveBeenCalledTimes(2);
  });

  it("mencatat hasil ambigu sebagai unknown tanpa mengulang token", async () => {
    const { service, campaigns, tokens, apps, database, sender } = await loadService();
    campaigns.findById
      .mockResolvedValueOnce(campaign())
      .mockResolvedValueOnce(campaign({ status: "unknown", unknownCount: 1 }));
    campaigns.claimForSend.mockResolvedValue(campaign({ status: "sending" }));
    apps.findById.mockResolvedValue(app());
    database.getAppConnection.mockResolvedValue(APP_DB);
    tokens.listTokens.mockResolvedValue([{ id: 1, token: "token-1" }]);
    sender.send.mockResolvedValue("unknown");
    campaigns.updateSending.mockResolvedValue(campaign({ status: "unknown", unknownCount: 1 }));

    const item = await service.sendCampaignNow("11", "1", AUDIT);

    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(item.status).toBe("unknown");
    expect(campaigns.updateSending).toHaveBeenLastCalledWith(
      CONTROL_DB,
      11,
      expect.objectContaining({ status: "unknown", sentCount: 0, failedCount: 0, unknownCount: 1 }),
    );
  });

  it("kegagalan App DB menandai failed + audit alasan, bukan menggantung sending", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const { service, campaigns, apps, database, activityLog } =
        await loadService();
      campaigns.findById
        .mockResolvedValueOnce(campaign())
        .mockResolvedValueOnce(campaign({ status: "failed" }));
      campaigns.claimForSend.mockResolvedValue(campaign({ status: "sending" }));
      apps.findById.mockResolvedValue(app());
      database.getAppConnection.mockRejectedValue(new Error("DB putus"));
      campaigns.updateSending.mockResolvedValue(campaign({ status: "failed" }));

      const item = await service.sendCampaignNow("11", "1", AUDIT);

      expect(campaigns.updateSending).toHaveBeenCalledWith(
        CONTROL_DB,
        11,
        expect.objectContaining({ status: "failed" }),
      );
      expect(activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "send", entityId: "11" }),
      );
      expect(item.status).toBe("failed");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("segmen last_active_days memfilter token basi waktu", async () => {
    const { service, campaigns, tokens, apps, database } = await loadService();
    campaigns.findById.mockResolvedValue(
      campaign({
        targetType: "segment",
        targetSegment: { last_active_days: 30 },
      }),
    );
    campaigns.claimForSend.mockResolvedValue(
      campaign({
        targetType: "segment",
        targetSegment: { last_active_days: 30 },
        status: "sending",
      }),
    );
    apps.findById.mockResolvedValue(app());
    database.getAppConnection.mockResolvedValue(APP_DB);
    tokens.listTokens.mockResolvedValue([]);
    campaigns.update.mockResolvedValue(campaign({ status: "sent" }));

    const before = Date.now();
    await service.sendCampaignNow("11", "1", AUDIT);

    const listCalls = tokens.listTokens.mock.calls as Array<
      [Db, { activeSince?: Date }]
    >;
    const options = listCalls[0]?.[1];
    expect(options?.activeSince).toBeInstanceOf(Date);
    const expected = before - 30 * 24 * 60 * 60 * 1000;
    expect(
      Math.abs((options?.activeSince as Date).getTime() - expected),
    ).toBeLessThan(60 * 1000);
  });

  it("segmen tanpa kriteria diperlakukan sebagai all", async () => {
    const { service, campaigns, tokens, apps, database } = await loadService();
    campaigns.findById.mockResolvedValue(
      campaign({ targetType: "segment", targetSegment: {} }),
    );
    campaigns.claimForSend.mockResolvedValue(campaign({ status: "sending" }));
    apps.findById.mockResolvedValue(app());
    database.getAppConnection.mockResolvedValue(APP_DB);
    tokens.listTokens.mockResolvedValue([]);
    campaigns.update.mockResolvedValue(campaign({ status: "sent" }));

    await service.sendCampaignNow("11", "1", AUDIT);

    expect(tokens.listTokens).toHaveBeenCalledWith(APP_DB, {
      activeSince: undefined,
    });
  });
});

describe("NotificationsService.reconcileStaleSending", () => {
  it("marks a stale send unknown and records an audit without invoking FCM", async () => {
    const { service, campaigns, activityLog, sender } = await loadService();
    campaigns.markStaleSendingUnknown.mockResolvedValue([
      campaign({ status: "unknown", targetCount: 2, unknownCount: 2 }),
    ]);

    const count = await service.reconcileStaleSending(new Date("2026-11-27T00:00:00Z"));

    expect(count).toBe(1);
    expect(sender.send).not.toHaveBeenCalled();
    expect(activityLog.record).toHaveBeenCalledTimes(1);
  });
});

describe("NotificationsService.cancelCampaign", () => {
  it.each(["draft", "sending", "sent", "failed", "cancelled"] as const)(
    "menolak batal saat status %s",
    async (status) => {
      const { service, campaigns } = await loadService();
      campaigns.findById.mockResolvedValue(campaign({ status }));

      await expect(
        service.cancelCampaign("11", "1", AUDIT),
      ).rejects.toThrow(BadRequestException);
      expect(campaigns.update).not.toHaveBeenCalled();
    },
  );

  it("membatalkan kampanye scheduled + audit cancel", async () => {
    const { service, campaigns, activityLog } = await loadService();
    campaigns.findById.mockResolvedValue(campaign({ status: "scheduled" }));
    campaigns.update.mockResolvedValue(campaign({ status: "cancelled" }));

    const item = await service.cancelCampaign("11", "1", AUDIT);

    expect(campaigns.update).toHaveBeenCalledWith(
      CONTROL_DB,
      11,
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cancel", entityId: "11" }),
    );
    expect(item.status).toBe("cancelled");
  });
});

describe("NotificationsService jalur runner", () => {
  it("token diambil dari App DB milik kampanye, bukan header", async () => {
    const { service, campaigns, tokens, apps, database } = await loadService();
    campaigns.findById.mockResolvedValue(
      campaign({ id: 11, appId: 2, status: "sending" }),
    );
    apps.findById.mockResolvedValue(app({ id: 2, slug: "ngewarung" }));
    database.getAppConnection.mockResolvedValue(APP_DB);
    tokens.listTokens.mockResolvedValue([]);
    campaigns.update.mockResolvedValue(campaign({ status: "sent" }));

    await service.executeClaimedCampaign(11);

    expect(apps.findById).toHaveBeenCalledWith(CONTROL_DB, 2);
    expect(database.getAppConnection).toHaveBeenCalledWith("ngewarung", {
      allowNonActive: true,
    });
  });

  it("melewati kampanye yang statusnya bukan sending", async () => {
    const { service, campaigns, tokens } = await loadService();
    campaigns.findById.mockResolvedValue(campaign({ status: "cancelled" }));

    const outcome = await service.executeClaimedCampaign(11);

    expect(outcome).toBe("skipped");
    expect(tokens.listTokens).not.toHaveBeenCalled();
    expect(campaigns.update).not.toHaveBeenCalled();
  });

  it("melewati aplikasi nonaktif dan mengembalikannya ke scheduled", async () => {
    const logSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    try {
      const { service, campaigns, tokens, apps } = await loadService();
      campaigns.findById.mockResolvedValue(campaign({ status: "sending" }));
      apps.findById.mockResolvedValue(app({ status: "suspended" }));

      const outcome = await service.executeClaimedCampaign(11);

      expect(outcome).toBe("skipped");
      expect(tokens.listTokens).not.toHaveBeenCalled();
      expect(campaigns.updateSending).toHaveBeenCalledWith(
        CONTROL_DB,
        11,
        expect.objectContaining({ status: "scheduled" }),
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("mendelegasikan klaim jatuh tempo ke repository", async () => {
    const { service, campaigns } = await loadService();
    const now = new Date("2026-11-18T00:00:00.000Z");
    campaigns.claimDueCampaigns.mockResolvedValue([campaign()]);

    const rows = await service.claimDueCampaigns(now, 10);

    expect(campaigns.claimDueCampaigns).toHaveBeenCalledWith(
      CONTROL_DB,
      now,
      10,
    );
    expect(rows).toHaveLength(1);
  });
});
