import { Module } from "@nestjs/common";
import { AppConfigsRepository } from "./app-configs.repository";
import { AppsRepository } from "./apps.repository";
import { AppsResolver } from "./apps.resolver";
import { AppsService } from "./apps.service";
import { FcmCredentialService } from "./fcm-credential.service";

@Module({
  providers: [
    AppsRepository,
    AppsResolver,
    AppsService,
    AppConfigsRepository,
    FcmCredentialService,
  ],
  exports: [AppsRepository, AppsService],
})
export class AppsModule {}
