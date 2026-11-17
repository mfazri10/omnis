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

@Module({
  // AppContextGuard di resolver ini membutuhkan AppsRepository milik AppsModule.
  imports: [ActivityLogsModule, AppsModule],
  providers: [
    CampaignsRepository,
    DeviceTokensRepository,
    NoopPushSender,
    {
      provide: PUSH_SENDER,
      useFactory: (config: ConfigService, noop: NoopPushSender) => {
        const driver = config.get<string>("PUSH_DRIVER") ?? "noop";
        if (driver !== "noop") {
          throw new Error(
            `Driver push "${driver}" belum tersedia di Fase 1 (hanya "noop"). Implementasi FCM menyusul.`,
          );
        }
        return noop;
      },
      inject: [ConfigService, NoopPushSender],
    },
    NotificationsService,
    CampaignRunnerService,
    NotificationsResolver,
  ],
})
export class NotificationsModule {}
