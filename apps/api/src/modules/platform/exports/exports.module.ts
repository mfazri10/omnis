import { Module } from "@nestjs/common";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AppsModule } from "../apps/apps.module";
import { AppUsersModule } from "../app-users/app-users.module";
import { CbtModule } from "../../cbt/cbt.module";
import { ActivityLogsExportResolver } from "./activity-logs-export.resolver";
import { AppUsersExportResolver } from "./app-users-export.resolver";
import { CbtResultsExportResolver } from "./cbt-results-export.resolver";
import { ExportRunnerService } from "./export-runner.service";
import { ExportFileStore } from "./export-file-store";
import { ExportJobsResolver } from "./export-jobs.resolver";
import { ExportsController } from "./exports.controller";
import { ExportsRepository } from "./exports.repository";
import { ExportsService } from "./exports.service";

@Module({
  // AppContextGuard di resolver ini membutuhkan AppsRepository milik AppsModule.
  // CbtModule menyediakan CbtSessionsRepository untuk sumber ekspor hasil CBT.
  imports: [ActivityLogsModule, AppsModule, AppUsersModule, CbtModule],
  controllers: [ExportsController],
  providers: [
    ExportsRepository,
    ExportFileStore,
    ExportsService,
    ExportRunnerService,
    AppUsersExportResolver,
    ActivityLogsExportResolver,
    CbtResultsExportResolver,
    ExportJobsResolver,
  ],
})
export class ExportsModule {}
