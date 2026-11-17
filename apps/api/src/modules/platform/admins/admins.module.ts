import { Module } from "@nestjs/common";
import { AdminsRepository } from "./admins.repository";
import { AdminsResolver } from "./admins.resolver";
import { AdminsService } from "./admins.service";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AppsModule } from "../apps/apps.module";
import { RbacModule } from "../rbac/rbac.module";

@Module({
  imports: [ActivityLogsModule, RbacModule, AppsModule],
  providers: [AdminsRepository, AdminsService, AdminsResolver],
  exports: [AdminsRepository, AdminsService],
})
export class AdminsModule {}
