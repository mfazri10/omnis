import { Module } from "@nestjs/common";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AppsModule } from "../apps/apps.module";
import { MobileMenusRepository } from "./mobile-menus.repository";
import { MobileMenusResolver } from "./mobile-menus.resolver";
import { MobileMenusService } from "./mobile-menus.service";

@Module({
  // AppContextGuard di resolver ini membutuhkan AppsRepository milik AppsModule.
  imports: [ActivityLogsModule, AppsModule],
  providers: [MobileMenusRepository, MobileMenusService, MobileMenusResolver],
})
export class MobileMenusModule {}
