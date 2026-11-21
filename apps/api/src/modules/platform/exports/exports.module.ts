import { Module } from "@nestjs/common";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AppsModule } from "../apps/apps.module";
import { AppUsersModule } from "../app-users/app-users.module";
import { ActivityLogsExportResolver } from "./activity-logs-export.resolver";
import { AppUsersExportResolver } from "./app-users-export.resolver";
import { ExportRunnerService } from "./export-runner.service";
import { ExportFileStore } from "./export-file-store";
import { ExportJobsResolver } from "./export-jobs.resolver";
import { ExportsController } from "./exports.controller";
import { ExportsRepository } from "./exports.repository";
import { ExportsService } from "./exports.service";

@Module({
  // AppContextGuard di resolver ini membutuhkan AppsRepository milik AppsModule.
  imports: [ActivityLogsModule, AppsModule, AppUsersModule],
  controllers: [ExportsController],
  providers: [
    ExportsRepository,
    ExportFileStore,
    ExportsService,
    ExportRunnerService,
    AppUsersExportResolver,
    ActivityLogsExportResolver,
    ExportJobsResolver,
  ],
})
export class ExportsModule {}
