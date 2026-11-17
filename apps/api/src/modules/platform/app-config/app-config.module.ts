import { Module } from "@nestjs/common";
import { AppsModule } from "../apps/apps.module";
import { AppConfigResolver } from "./app-config.resolver";
import { AppConfigService } from "./app-config.service";

@Module({
  imports: [AppsModule],
  providers: [AppConfigResolver, AppConfigService],
})
export class AppConfigModule {}
