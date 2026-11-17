import type { AppContext as AppContextData } from "../../../common/types/request-context";
import type { ActivityLogService } from "../activity-logs/activity-log.service";
import type { AdminProfile } from "../admins/admins.service";
import { AppConfigResolver } from "./app-config.resolver";
import type { AppConfigService, EffectiveAppConfig } from "./app-config.service";

function makeResolver(): {
  resolver: AppConfigResolver;
  appConfigService: { updateConfig: jest.Mock };
  activityLog: { record: jest.Mock };
} {
  const appConfigService = { updateConfig: jest.fn() };
  const activityLog = { record: jest.fn() };
  const resolver = new AppConfigResolver(
    appConfigService as unknown as AppConfigService,
    activityLog as unknown as ActivityLogService,
  );
  return { resolver, appConfigService, activityLog };
}

function ctx(): AppContextData {
  return {
    appId: "1",
    slug: "tes-cpns",
    name: "Tes CPNS",
    status: "active",
    dbName: "app_tes_cpns",
  };
}

function admin(): AdminProfile {
  return {
    id: "7",
    authUserId: "auth-1",
    name: "Sari",
    email: "sari@example.com",
    isSuperAdmin: true,
  };
}

function effective(): EffectiveAppConfig {
  return {
    appId: "1",
    maintenanceMode: true,
    maintenanceMessage: null,
    minVersionAndroid: "1.0.0",
    minVersionIos: "1.0.0",
    themePrimaryColor: "#1976D2",
    logoMediaUrl: null,
    supportEmail: null,
    supportWhatsapp: null,
    updatedAt: new Date("2026-11-17T00:00:00.000Z"),
    displayName: "Tes CPNS",
    slug: "tes-cpns",
    iconMediaUrl: null,
    storeUrlAndroid: null,
    storeUrlIos: null,
  };
}

describe("AppConfigResolver audit", () => {
  it("updateAppConfig mencatat audit dengan action + app_id + admin_id", async () => {
    const { resolver, appConfigService, activityLog } = makeResolver();
    appConfigService.updateConfig.mockResolvedValue(effective());
    await resolver.updateAppConfig(
      ctx(),
      { maintenanceMode: true },
      admin(),
      "203.0.113.7",
    );
    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "7",
      appId: "1",
      action: "update",
      entityType: "app_config",
      entityId: "1",
      summary: "Mengubah konfigurasi aplikasi Tes CPNS",
      ip: "203.0.113.7",
    });
  });

  it("updateAppConfig gagal → audit tidak dicatat", async () => {
    const { resolver, appConfigService, activityLog } = makeResolver();
    appConfigService.updateConfig.mockRejectedValue(
      new Error("Konfigurasi aplikasi tidak ditemukan."),
    );
    await expect(
      resolver.updateAppConfig(
        ctx(),
        { maintenanceMode: true },
        admin(),
        "203.0.113.7",
      ),
    ).rejects.toThrow("Konfigurasi aplikasi tidak ditemukan.");
    expect(activityLog.record).not.toHaveBeenCalled();
  });
});
