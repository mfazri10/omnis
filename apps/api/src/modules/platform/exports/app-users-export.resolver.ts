import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { AppContext } from "../../../common/decorators/app-context.decorator";
import type { AppContext as AppContextData } from "../../../common/types/request-context";
import { AppScoped } from "../../../common/decorators/app-scoped.decorator";
import { ClientIp } from "../../../common/decorators/client-ip.decorator";
import { CurrentAdmin } from "../../../common/decorators/current-admin.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import type { AdminProfile } from "../admins/admins.service";
import { ExportAppUsersArgs } from "./dto/export.input";
import { ExportsService } from "./exports.service";
import { ExportJobType } from "./types/export-job.type";

@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
export class AppUsersExportResolver {
  constructor(private readonly exportsService: ExportsService) {}

  @Mutation(() => ExportJobType)
  @AppScoped()
  @RequirePermissions("platform.users.view")
  async exportAppUsers(
    @Args() args: ExportAppUsersArgs,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<ExportJobType> {
    const item = await this.exportsService.request(
      "app_users",
      {
        search: args.filter?.search,
        status: args.filter?.status,
      },
      admin,
      { appId: ctx.appId, slug: ctx.slug },
      ip,
    );
    return { ...item };
  }
}
