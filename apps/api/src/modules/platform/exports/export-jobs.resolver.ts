import { UseGuards } from "@nestjs/common";
import { Args, ID, Int, Query, Resolver } from "@nestjs/graphql";
import { CurrentAdmin } from "../../../common/decorators/current-admin.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import type { AdminProfile } from "../admins/admins.service";
import { ExportsService } from "./exports.service";
import { ExportJobType } from "./types/export-job.type";

/**
 * Daftar job milik admin yang login. Tanpa PermissionGuard:
 * kepemilikan dipaksa di service (hanya job sendiri yang terbaca).
 */
@Resolver()
@UseGuards(AuthGuard)
export class ExportJobsResolver {
  constructor(private readonly exportsService: ExportsService) {}

  @Query(() => ExportJobType)
  async exportJob(
    @Args("id", { type: () => ID }) id: string,
    @CurrentAdmin() admin: AdminProfile,
  ): Promise<ExportJobType> {
    const item = await this.exportsService.getJob(id, admin);
    return { ...item };
  }

  @Query(() => [ExportJobType])
  async exportJobs(
    @Args("limit", { type: () => Int, defaultValue: 10 }) limit: number,
    @CurrentAdmin() admin: AdminProfile,
  ): Promise<ExportJobType[]> {
    const items = await this.exportsService.listJobs(admin, limit);
    return items.map((item) => ({ ...item }));
  }
}
