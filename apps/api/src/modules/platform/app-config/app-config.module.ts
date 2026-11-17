import { Module } from "@nestjs/common";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AppsModule } from "../apps/apps.module";
import { AppConfigResolver } from "./app-config.resolver";
import { AppConfigService } from "./app-config.service";

@Module({
  imports: [ActivityLogsModule, AppsModule],
  providers: [AppConfigResolver, AppConfigService],
})
export class AppConfigModule {}
