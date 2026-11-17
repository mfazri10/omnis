import { Module } from "@nestjs/common";
import { ActivityLogResolver } from "./activity-log.resolver";
import { ActivityLogService } from "./activity-log.service";
import { ActivityLogsRepository } from "./activity-logs.repository";

@Module({
  providers: [ActivityLogsRepository, ActivityLogService, ActivityLogResolver],
  exports: [ActivityLogService],
})
export class ActivityLogsModule {}
