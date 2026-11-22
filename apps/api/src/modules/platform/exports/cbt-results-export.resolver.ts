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
import { ExportCbtResultsArgs } from "./dto/export.input";
import { ExportsService } from "./exports.service";
import { ExportJobType } from "./types/export-job.type";

/**
 * Ekspor CSV hasil CBT (F12). Sumber app-scoped: hasil hidup di App DB
 * aplikasi konteks, dan permission mengikuti `cbt.results.view` —
 * admin yang boleh melihat daftar hasil boleh mengunduhnya.
 */
@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
export class CbtResultsExportResolver {
  constructor(private readonly exportsService: ExportsService) {}

  @Mutation(() => ExportJobType)
  @AppScoped()
  @RequirePermissions("cbt.results.view")
  async exportCbtResults(
    @Args() args: ExportCbtResultsArgs,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<ExportJobType> {
    const item = await this.exportsService.request(
      "cbt_results",
      {
        packageId: args.filter?.packageId,
        passed: args.filter?.passed,
      },
      admin,
      { appId: ctx.appId, slug: ctx.slug },
      ip,
    );
    return { ...item };
  }
}
