import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AppsModule } from "../apps/apps.module";
import { CampaignRunnerService } from "./campaign-runner.service";
import { DeviceTokensRepository } from "./device-tokens.repository";
import { CampaignsRepository } from "./notifications.repository";
import { NotificationsResolver } from "./notifications.resolver";
import { NotificationsService } from "./notifications.service";
import { NoopPushSender, PUSH_SENDER } from "./push-sender";
import { FcmPushSender } from "./fcm-push-sender";

@Module({
  // AppContextGuard di resolver ini membutuhkan AppsRepository milik AppsModule.
  imports: [ActivityLogsModule, AppsModule],
  providers: [
    CampaignsRepository,
    DeviceTokensRepository,
    NoopPushSender,
    FcmPushSender,
    {
      provide: PUSH_SENDER,
      useFactory: (
        config: ConfigService,
        noop: NoopPushSender,
        fcm: FcmPushSender,
      ) => {
        const driver = config.get<string>("PUSH_DRIVER") ?? "noop";
        if (driver === "noop") {
          if (config.get<string>("NODE_ENV") === "production") {
            throw new Error('PUSH_DRIVER="noop" tidak boleh dipakai di production.');
          }
          return noop;
        }
        if (driver === "fcm") {
          if (!config.get<string>("FCM_CREDENTIAL_KEY")) {
            throw new Error("FCM_CREDENTIAL_KEY wajib saat PUSH_DRIVER=fcm.");
          }
          return fcm;
        }
        throw new Error(`Driver push tidak dikenal: ${driver}`);
      },
      inject: [ConfigService, NoopPushSender, FcmPushSender],
    },
    NotificationsService,
    CampaignRunnerService,
    NotificationsResolver,
  ],
})
export class NotificationsModule {}
