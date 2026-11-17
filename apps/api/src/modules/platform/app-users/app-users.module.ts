import { Module } from "@nestjs/common";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AppsModule } from "../apps/apps.module";
import { AppUsersRepository } from "./app-users.repository";
import { AppUsersResolver } from "./app-users.resolver";
import { AppUsersService } from "./app-users.service";

@Module({
  // AppContextGuard di resolver ini membutuhkan AppsRepository milik AppsModule.
  imports: [ActivityLogsModule, AppsModule],
  providers: [AppUsersRepository, AppUsersService, AppUsersResolver],
})
export class AppUsersModule {}
