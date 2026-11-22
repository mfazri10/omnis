import { Module } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { ActivityLogsModule } from "../platform/activity-logs/activity-logs.module";
import { AppUsersModule } from "../platform/app-users/app-users.module";
import { AppsModule } from "../platform/apps/apps.module";
import { PermissionsService } from "../platform/rbac/permissions.service";
import { CBT_CATALOG } from "./cbt.permissions";
import { CbtDashboardSection } from "./cbt-dashboard.section";
import { CbtTablesInterceptor } from "./cbt-tables.interceptor";
import { CbtPackagesRepository } from "./packages.repository";
import { CbtPackagesResolver } from "./packages.resolver";
import { CbtPackagesService } from "./packages.service";
import { CbtQuestionsRepository } from "./questions.repository";
import { CbtQuestionsResolver } from "./questions.resolver";
import { CbtQuestionsService } from "./questions.service";
import { CbtSessionsRepository } from "./sessions.repository";
import { CbtSessionsResolver } from "./sessions.resolver";
import { CbtSessionsService } from "./sessions.service";

/**
 * Modul domain pertama (F12, pola modul baku doc 05 §3): entities +
 * migrasi App DB sendiri (scope app-cbt), resolver app-scoped dengan
 * guard per operasi, katalog permission yang disinkronkan saat boot,
 * kartu dashboard lewat DashboardSection, dan audit log aksi penting.
 * RbacModule @Global menyediakan PermissionsService/guard.
 */
@Module({
  imports: [ActivityLogsModule, AppsModule, AppUsersModule],
  providers: [
    CbtQuestionsRepository,
    CbtPackagesRepository,
    CbtSessionsRepository,
    CbtQuestionsService,
    CbtPackagesService,
    CbtSessionsService,
    CbtQuestionsResolver,
    CbtPackagesResolver,
    CbtSessionsResolver,
    CbtTablesInterceptor,
    CbtDashboardSection,
  ],
  exports: [CbtDashboardSection, CbtSessionsRepository],
})
export class CbtModule implements OnModuleInit {
  constructor(private readonly permissions: PermissionsService) {}

  async onModuleInit(): Promise<void> {
    await this.permissions.syncCatalog(CBT_CATALOG);
  }
}
