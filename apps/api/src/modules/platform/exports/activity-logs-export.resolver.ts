import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { ClientIp } from "../../../common/decorators/client-ip.decorator";
import { CurrentAdmin } from "../../../common/decorators/current-admin.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import type { AdminProfile } from "../admins/admins.service";
import { ExportActivityLogsArgs } from "./dto/export.input";
import { ExportsService } from "./exports.service";
import { ExportJobType } from "./types/export-job.type";

@Resolver()
@UseGuards(AuthGuard, PermissionGuard)
export class ActivityLogsExportResolver {
  constructor(private readonly exportsService: ExportsService) {}

  @Mutation(() => ExportJobType)
  @RequirePermissions("platform.audit.view")
  async exportActivityLogs(
    @Args() args: ExportActivityLogsArgs,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<ExportJobType> {
    const filter = args.filter;
    const item = await this.exportsService.request(
      "activity_logs",
      {
        dateFrom: filter?.dateFrom,
        dateTo: filter?.dateTo,
        appId: filter?.appId,
        adminId: filter?.adminId,
        entityType: filter?.entityType,
        action: filter?.action,
        search: filter?.search,
      },
      admin,
      null,
      ip,
    );
    return { ...item };
  }
}
