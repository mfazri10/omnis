import { Reflector } from "@nestjs/core";
import { APP_SCOPED_KEY } from "../../../common/decorators/app-scoped.decorator";
import { PERMISSIONS_KEY } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { NotificationsResolver } from "./notifications.resolver";

const reflector = new Reflector();

function permsOf(target: object, method: string): string[] | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[
    method
  ];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<string[]>(PERMISSIONS_KEY, fn);
}

function guardsOf(target: object): unknown[] {
  return (Reflect.getMetadata("__guards__", target) as unknown[]) ?? [];
}

function scopedOf(target: object, method: string): boolean | undefined {
  const fn = (target as Record<string, (...args: never[]) => unknown>)[
    method
  ];
  if (typeof fn !== "function") {
    throw new Error(`Method tak ada: ${method}`);
  }
  return reflector.get<boolean>(APP_SCOPED_KEY, fn);
}

describe("NotificationsResolver metadata", () => {
  it("dikunci AuthGuard + AppContextGuard + PermissionGuard urut", () => {
    expect(guardsOf(NotificationsResolver)).toEqual([
      AuthGuard,
      AppContextGuard,
      PermissionGuard,
    ]);
  });

  it.each(["campaigns", "campaign"])(
    "%s → platform.notifications.view",
    (method: string) => {
      expect(permsOf(NotificationsResolver.prototype, method)).toEqual([
        "platform.notifications.view",
      ]);
    },
  );

  it.each([
    "createCampaign",
    "updateCampaign",
    "sendCampaignNow",
    "cancelCampaign",
  ])("%s → platform.notifications.send", (method: string) => {
    expect(permsOf(NotificationsResolver.prototype, method)).toEqual([
      "platform.notifications.send",
    ]);
  });

  it.each([
    "campaigns",
    "campaign",
    "createCampaign",
    "updateCampaign",
    "sendCampaignNow",
    "cancelCampaign",
  ])("%s bertanda @AppScoped", (method: string) => {
    expect(scopedOf(NotificationsResolver.prototype, method)).toBe(true);
  });

  /**
   * Regresi: ValidationPipe global memakai whitelist + forbidNonWhitelisted.
   * Filter wajib menjadi properti kelas ArgsType agar request berfilter
   * tidak ditolak 400 (pola F06).
   */
  it("argumen campaigns menerima filter tanpa ditolak whitelist", async () => {
    const { ValidationPipe } = await import("@nestjs/common");
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const { CampaignPageArgs } = await import("./dto/campaign.input");
    const transformed = (await pipe.transform(
      { page: 1, perPage: 20, filter: { status: "scheduled", search: "promo" } },
      { type: "body", metatype: CampaignPageArgs },
    )) as InstanceType<typeof CampaignPageArgs>;

    expect(transformed.filter?.status).toBe("scheduled");
    expect(transformed.filter?.search).toBe("promo");
    expect(transformed.page).toBe(1);
  });
});
