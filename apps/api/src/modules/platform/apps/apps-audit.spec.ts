import type { ActivityLogService } from "../activity-logs/activity-log.service";
import type { AdminProfile } from "../admins/admins.service";
import { AppsResolver } from "./apps.resolver";
import type { AppsService } from "./apps.service";
import type { ProvisioningService } from "./provisioning.service";

function makeResolver(): {
  resolver: AppsResolver;
  appsService: { deleteApp: jest.Mock; setFcmCredential: jest.Mock };
  activityLog: { record: jest.Mock };
} {
  const appsService = { deleteApp: jest.fn(), setFcmCredential: jest.fn() };
  const provisioning = {};
  const activityLog = { record: jest.fn() };
  const resolver = new AppsResolver(
    appsService as unknown as AppsService,
    provisioning as unknown as ProvisioningService,
    activityLog as unknown as ActivityLogService,
  );
  return { resolver, appsService, activityLog };
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

describe("AppsResolver audit", () => {
  it("deleteApp mencatat audit dengan action + entity app + admin", async () => {
    const { resolver, appsService, activityLog } = makeResolver();
    appsService.deleteApp.mockResolvedValue({ id: "3", name: "Tes TKD" });
    const ok = await resolver.deleteApp("3", admin(), "203.0.113.7");
    expect(ok).toBe(true);
    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "7",
      appId: null,
      action: "delete",
      entityType: "app",
      entityId: "3",
      summary: "Menghapus aplikasi Tes TKD",
      ip: "203.0.113.7",
    });
  });

  it("deleteApp gagal → audit tidak dicatat", async () => {
    const { resolver, appsService, activityLog } = makeResolver();
    appsService.deleteApp.mockRejectedValue(
      new Error("Hanya aplikasi gagal yang bisa dihapus."),
    );
    await expect(resolver.deleteApp("3", admin(), "203.0.113.7")).rejects.toThrow(
      "Hanya aplikasi gagal yang bisa dihapus.",
    );
    expect(activityLog.record).not.toHaveBeenCalled();
  });

  it("setFcmCredential mencatat audit dengan action + entity app + admin", async () => {
    const { resolver, appsService, activityLog } = makeResolver();
    appsService.setFcmCredential.mockResolvedValue({
      id: "3",
      name: "Tes TKD",
    });
    const ok = await resolver.setFcmCredential(
      "3",
      '{"project_id":"x"}',
      admin(),
      "203.0.113.7",
    );
    expect(ok).toBe(true);
    expect(activityLog.record).toHaveBeenCalledWith({
      adminId: "7",
      appId: null,
      action: "update",
      entityType: "app",
      entityId: "3",
      summary: "Memperbarui kredensial FCM aplikasi Tes TKD",
      ip: "203.0.113.7",
    });
  });

  it("setFcmCredential gagal → audit tidak dicatat", async () => {
    const { resolver, appsService, activityLog } = makeResolver();
    appsService.setFcmCredential.mockRejectedValue(
      new Error("Kredensial FCM bukan JSON valid."),
    );
    await expect(
      resolver.setFcmCredential("3", "bukan-json", admin(), "203.0.113.7"),
    ).rejects.toThrow("Kredensial FCM bukan JSON valid.");
    expect(activityLog.record).not.toHaveBeenCalled();
  });
});
