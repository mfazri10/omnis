import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AppContext } from "../../../common/decorators/app-context.decorator";
import type { AppContext as AppContextData } from "../../../common/types/request-context";
import { AppScoped } from "../../../common/decorators/app-scoped.decorator";
import { ClientIp } from "../../../common/decorators/client-ip.decorator";
import { CurrentAdmin } from "../../../common/decorators/current-admin.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import type { AdminProfile } from "../admins/admins.service";
import { AppConfigService } from "./app-config.service";
import { UpdateAppConfigInput } from "./dto/app-config.input";
import { AppConfigType } from "./types/app-config.type";

@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
export class AppConfigResolver {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Query(() => AppConfigType)
  @AppScoped()
  @RequirePermissions("platform.app-config.view")
  async appConfig(
    @AppContext() ctx: AppContextData,
  ): Promise<AppConfigType> {
    const effective = await this.appConfigService.getEffectiveConfig(
      ctx.appId,
    );
    return { ...effective };
  }

  @Mutation(() => AppConfigType)
  @AppScoped()
  @RequirePermissions("platform.app-config.manage")
  async updateAppConfig(
    @AppContext() ctx: AppContextData,
    @Args("input", { type: () => UpdateAppConfigInput })
    input: UpdateAppConfigInput,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<AppConfigType> {
    const effective = await this.appConfigService.updateConfig(
      ctx.appId,
      input,
    );
    await this.activityLog.record({
      adminId: admin.id,
      appId: ctx.appId,
      action: "update",
      entityType: "app_config",
      entityId: ctx.appId,
      summary: `Mengubah konfigurasi aplikasi ${effective.displayName}`,
      ip,
    });
    return { ...effective };
  }
}
