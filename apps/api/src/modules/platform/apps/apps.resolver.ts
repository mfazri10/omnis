import { UseGuards } from "@nestjs/common";
import { Query, Resolver } from "@nestjs/graphql";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import type { Db } from "../../../database/database.service";
import { DatabaseService } from "../../../database/database.service";
import { AppsRepository } from "./apps.repository";
import { AppType } from "./types/app.type";

@Resolver()
@UseGuards(AuthGuard, PermissionGuard)
export class AppsResolver {
  constructor(
    private readonly database: DatabaseService,
    private readonly appsRepository: AppsRepository,
  ) {}

  @Query(() => [AppType])
  @RequirePermissions("platform.apps.view")
  async apps(): Promise<AppType[]> {
    const db: Db = this.database.getControlPlaneConnection();
    const rows = await this.appsRepository.listActive(db);
    return rows.map((row) => ({
      id: String(row.id),
      slug: row.slug,
      name: row.name,
      status: row.status,
    }));
  }
}
