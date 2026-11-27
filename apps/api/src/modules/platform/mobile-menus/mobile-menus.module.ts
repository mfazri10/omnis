import { Module } from "@nestjs/common";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { MobileMenusRepository } from "./mobile-menus.repository";
import { MobileMenusResolver } from "./mobile-menus.resolver";
import { MobileMenusService } from "./mobile-menus.service";

@Module({
  imports: [ActivityLogsModule],
  providers: [MobileMenusRepository, MobileMenusService, MobileMenusResolver],
})
export class MobileMenusModule {}
