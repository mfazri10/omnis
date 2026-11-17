import { NotFoundException } from "@nestjs/common";
import type { DatabaseService } from "../../../database/database.service";
import type { AppRow } from "../entities/apps.entity";
import type { AppConfigRow } from "../entities/app-configs.entity";
import type { AppConfigsRepository } from "../apps/app-configs.repository";
import type { AppsRepository } from "../apps/apps.repository";
import { AppConfigService } from "./app-config.service";

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeService(): {
  service: AppConfigService;
  apps: Mocked<AppsRepository>;
  configs: Mocked<AppConfigsRepository>;
} {
  const apps: Mocked<AppsRepository> = {
    findById: jest.fn(),
    findBySlug: jest.fn(),
    listActive: jest.fn(),
    findByIds: jest.fn(),
    insert: jest.fn(),
    list: jest.fn(),
    updateById: jest.fn(),
    deleteById: jest.fn(),
    activateIfProvisioning: jest.fn(),
  };
  const configs: Mocked<AppConfigsRepository> = {
    insertDefault: jest.fn(),
    deleteByAppId: jest.fn(),
    findByAppId: jest.fn(),
    insertDefaultIfMissing: jest.fn(),
    updateByAppId: jest.fn(),
  };
  const database = {
    getControlPlaneConnection: jest.fn().mockReturnValue({}),
  } as unknown as DatabaseService;
  const service = new AppConfigService(database, apps, configs);
  return { service, apps, configs };
}

function appRow(over: Partial<AppRow> = {}): AppRow {
  return {
    id: 1,
    name: "Tes CPNS",
    slug: "tes-cpns",
    iconMediaUrl: "https://cdn/con/registry.png",
    status: "active",
    dbName: "app_tes_cpns",
    androidPackage: null,
    iosBundleId: null,
    storeUrlAndroid: "https://play/store/tescpns",
    storeUrlIos: null,
    fcmCredential: null,
    notes: null,
    failureReason: null,
    lastProvisioningAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

function configRow(over: Partial<AppConfigRow> = {}): AppConfigRow {
  return {
    appId: 1,
    maintenanceMode: false,
    maintenanceMessage: null,
    minVersionAndroid: "1.0.0",
    minVersionIos: "1.0.0",
    themePrimaryColor: "#1976D2",
    logoMediaUrl: null,
    supportEmail: null,
    supportWhatsapp: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

describe("AppConfigService", () => {
  it("membuat baris default bila config belum ada", async () => {
    const { service, apps, configs } = makeService();
    apps.findById.mockResolvedValue(appRow());
    configs.findByAppId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(configRow());
    const effective = await service.getEffectiveConfig("1");
    expect(configs.insertDefaultIfMissing).toHaveBeenCalledWith(
      expect.anything(),
      1,
    );
    expect(effective.displayName).toBe("Tes CPNS");
    expect(effective.slug).toBe("tes-cpns");
  });

  it("tidak membuat ulang baris bila config sudah ada (idempoten)", async () => {
    const { service, apps, configs } = makeService();
    apps.findById.mockResolvedValue(appRow());
    configs.findByAppId.mockResolvedValue(configRow());
    await service.getEffectiveConfig("1");
    expect(configs.insertDefaultIfMissing).not.toHaveBeenCalled();
  });

  it("maintenance aktif tanpa pesan tetap tersimpan (pesan tidak wajib)", async () => {
    const { service, apps, configs } = makeService();
    apps.findById.mockResolvedValue(appRow());
    configs.findByAppId.mockResolvedValue(configRow());
    configs.updateByAppId.mockResolvedValue(undefined);
    const effective = await service.updateConfig("1", {
      maintenanceMode: true,
    });
    expect(configs.updateByAppId).toHaveBeenCalledWith(
      expect.anything(),
      1,
      expect.objectContaining({ maintenanceMode: true }),
    );
    expect(effective.slug).toBe("tes-cpns");
  });

  it("logo config menimpa icon registry pada nilai efektif", async () => {
    const { service, apps, configs } = makeService();
    apps.findById.mockResolvedValue(appRow());
    configs.findByAppId.mockResolvedValue(
      configRow({ logoMediaUrl: "https://cdn/con/logo-config.png" }),
    );
    const effective = await service.getEffectiveConfig("1");
    expect(effective.iconMediaUrl).toBe("https://cdn/con/logo-config.png");
  });

  it("logo config null memakai icon registry pada nilai efektif", async () => {
    const { service, apps, configs } = makeService();
    apps.findById.mockResolvedValue(appRow());
    configs.findByAppId.mockResolvedValue(
      configRow({ logoMediaUrl: null }),
    );
    const effective = await service.getEffectiveConfig("1");
    expect(effective.iconMediaUrl).toBe("https://cdn/con/registry.png");
  });

  it("update menulis updated_at", async () => {
    const { service, apps, configs } = makeService();
    apps.findById.mockResolvedValue(appRow());
    configs.findByAppId.mockResolvedValue(configRow());
    await service.updateConfig("1", {
      maintenanceMode: false,
      themePrimaryColor: "#00AA00",
    });
    expect(configs.updateByAppId).toHaveBeenCalledTimes(1);
    const calls = configs.updateByAppId.mock.calls as unknown[][];
    const patch = calls[0]?.[2] as { updatedAt?: unknown } | undefined;
    expect(patch?.updatedAt).toBeInstanceOf(Date);
  });

  it("update parsial hanya menulis field yang dikirim", async () => {
    const { service, apps, configs } = makeService();
    apps.findById.mockResolvedValue(appRow());
    configs.findByAppId.mockResolvedValue(configRow());
    await service.updateConfig("1", { maintenanceMode: true });
    const calls = configs.updateByAppId.mock.calls as unknown[][];
    const patch = calls[0]?.[2] as Record<string, unknown> | undefined;
    expect(patch).toBeDefined();
    expect(Object.keys(patch ?? {}).sort()).toEqual(
      ["maintenanceMode", "updatedAt"].sort(),
    );
  });

  it("aplikasi tidak ada → NotFoundException tanpa menyentuh config", async () => {
    const { service, apps, configs } = makeService();
    apps.findById.mockResolvedValue(null);
    await expect(service.getEffectiveConfig("99")).rejects.toThrow(
      NotFoundException,
    );
    expect(configs.findByAppId).not.toHaveBeenCalled();
    expect(configs.insertDefaultIfMissing).not.toHaveBeenCalled();
  });
});
