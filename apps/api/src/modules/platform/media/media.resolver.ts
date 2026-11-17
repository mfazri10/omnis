import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AppContext } from "../../../common/decorators/app-context.decorator";
import type { AppContext as AppContextData } from "../../../common/types/request-context";
import { AppDb } from "../../../common/decorators/app-db.decorator";
import { AppScoped } from "../../../common/decorators/app-scoped.decorator";
import { ClientIp } from "../../../common/decorators/client-ip.decorator";
import { CurrentAdmin } from "../../../common/decorators/current-admin.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import type { Db } from "../../../database/database.service";
import type { AdminProfile } from "../admins/admins.service";
import { MediaPageArgs } from "./dto/media.input";
import { MediaService } from "./media.service";
import type { MediaAuditContext } from "./media.service";
import { MediaConnection, MediaType } from "./types/media.type";

function toAudit(
  admin: AdminProfile,
  ctx: AppContextData,
  ip: string | null,
): MediaAuditContext {
  return { adminId: admin.id, appId: ctx.appId, ip };
}

@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
export class MediaResolver {
  constructor(private readonly mediaService: MediaService) {}

  @Query(() => MediaConnection)
  @AppScoped()
  @RequirePermissions("platform.media.view")
  async media(
    @Args() args: MediaPageArgs,
    @AppDb() db: Db,
  ): Promise<MediaConnection> {
    const { items, total } = await this.mediaService.list(
      {
        filter: { search: args.filter?.search },
        page: args.page,
        perPage: args.perPage,
      },
      db,
    );
    const connection = new MediaConnection();
    connection.items = items.map((item): MediaType => ({ ...item }));
    connection.total = total;
    return connection;
  }

  @Mutation(() => Boolean)
  @AppScoped()
  @RequirePermissions("platform.media.delete")
  async deleteMedia(
    @Args("id", { type: () => ID }) id: string,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    return this.mediaService.remove(id, db, ctx.slug, toAudit(admin, ctx, ip));
  }
}
