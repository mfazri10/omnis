import { UseGuards } from "@nestjs/common";
import { Query, Resolver } from "@nestjs/graphql";
import { AppContext } from "../../../common/decorators/app-context.decorator";
import type { AppContext as AppContextData } from "../../../common/types/request-context";
import { AppDb } from "../../../common/decorators/app-db.decorator";
import { AppScoped } from "../../../common/decorators/app-scoped.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import type { Db } from "../../../database/database.service";
import { ActivityLogType } from "../activity-logs/types/activity-log.type";
import type { ActivityLogItem } from "../activity-logs/activity-log.service";
import { DashboardService } from "./dashboard.service";
import {
  AppCampaignSummaryType,
  AppDashboardAppType,
  AppDashboardType,
  DashboardSectionType,
  NotificationQueueType,
  PlatformAppCardType,
  PlatformDashboardType,
} from "./types/dashboard.type";

function toActivityType(item: ActivityLogItem): ActivityLogType {
  return { ...item };
}

@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @Query(() => PlatformDashboardType)
  @RequirePermissions("platform.apps.view")
  async platformDashboard(): Promise<PlatformDashboardType> {
    const data = await this.dashboardService.platformDashboard();
    const result = new PlatformDashboardType();
    result.apps = data.apps.map(
      (card): PlatformAppCardType => ({ ...card }),
    );
    result.recentActivity = data.recentActivity.map(toActivityType);
    const queue = new NotificationQueueType();
    queue.scheduled = data.notificationQueue.scheduled;
    queue.sending = data.notificationQueue.sending;
    queue.failed = data.notificationQueue.failed;
    result.notificationQueue = queue;
    return result;
  }

  /**
   * App-scoped tanpa permission tambahan: hak atas aplikasi sudah
   * ditegakkan AppContextGuard (grant aplikasi). Guard permission
   * lolos bila operasi tak membawa metadata permission.
   */
  @Query(() => AppDashboardType)
  @AppScoped()
  async appDashboard(
    @AppContext() ctx: AppContextData,
    @AppDb() db: Db,
  ): Promise<AppDashboardType> {
    const data = await this.dashboardService.appDashboard(ctx, db);
    const result = new AppDashboardType();
    const app = new AppDashboardAppType();
    app.id = data.app.id;
    app.slug = data.app.slug;
    app.name = data.app.name;
    app.status = data.app.status;
    result.app = app;
    result.sections = data.sections.map(
      (section): DashboardSectionType => ({ ...section }),
    );
    result.recentActivity = data.recentActivity.map(toActivityType);
    const campaigns = new AppCampaignSummaryType();
    campaigns.draft = data.campaigns.draft;
    campaigns.scheduled = data.campaigns.scheduled;
    campaigns.sent = data.campaigns.sent;
    campaigns.failed = data.campaigns.failed;
    result.campaigns = campaigns;
    return result;
  }
}
