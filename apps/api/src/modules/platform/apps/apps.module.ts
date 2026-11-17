import { Module } from "@nestjs/common";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AppConfigsRepository } from "./app-configs.repository";
import { AppsRepository } from "./apps.repository";
import { AppsResolver } from "./apps.resolver";
import { AppsService } from "./apps.service";
import { FcmCredentialService } from "./fcm-credential.service";
import { ProvisioningService } from "./provisioning.service";

@Module({
  imports: [ActivityLogsModule],
  providers: [
    AppsRepository,
    AppsResolver,
    AppsService,
    AppConfigsRepository,
    FcmCredentialService,
    ProvisioningService,
  ],
  exports: [AppsRepository, AppsService, AppConfigsRepository],
})
export class AppsModule {}
