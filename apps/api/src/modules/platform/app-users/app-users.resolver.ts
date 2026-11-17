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
import { AppUsersService } from "./app-users.service";
import type { AppUserAuditContext } from "./app-users.service";
import {
  AppUserPageArgs,
  CreateAppUserInput,
  UpdateAppUserInput,
} from "./dto/app-user.input";
import { AppUserConnection, AppUserType } from "./types/app-user.type";

function toAudit(
  admin: AdminProfile,
  ctx: AppContextData,
  ip: string | null,
): AppUserAuditContext {
  return { adminId: admin.id, appId: ctx.appId, ip };
}

@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
export class AppUsersResolver {
  constructor(private readonly appUsersService: AppUsersService) {}

  @Query(() => AppUserConnection)
  @AppScoped()
  @RequirePermissions("platform.users.view")
  async appUsers(
    @Args() args: AppUserPageArgs,
    @AppDb() db: Db,
    @AppContext() _ctx: AppContextData,
  ): Promise<AppUserConnection> {
    void _ctx;
    const filter = args.filter;
    const { items, total } = await this.appUsersService.list(
      {
        filter: {
          search: filter?.search,
          status: filter?.status,
        },
        page: args.page,
        perPage: args.perPage,
      },
      db,
    );
    const connection = new AppUserConnection();
    connection.items = items.map((item): AppUserType => ({ ...item }));
    connection.total = total;
    return connection;
  }

  @Mutation(() => AppUserType)
  @AppScoped()
  @RequirePermissions("platform.users.manage")
  async createAppUser(
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @Args("input", { type: () => CreateAppUserInput })
    input: CreateAppUserInput,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<AppUserType> {
    const created = await this.appUsersService.create(
      input,
      db,
      toAudit(admin, ctx, ip),
    );
    return { ...created };
  }

  @Mutation(() => AppUserType)
  @AppScoped()
  @RequirePermissions("platform.users.manage")
  async updateAppUser(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { type: () => UpdateAppUserInput })
    input: UpdateAppUserInput,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<AppUserType> {
    const updated = await this.appUsersService.update(
      id,
      input,
      db,
      toAudit(admin, ctx, ip),
    );
    return { ...updated };
  }

  @Mutation(() => AppUserType)
  @AppScoped()
  @RequirePermissions("platform.users.manage")
  async setAppUserActive(
    @Args("id", { type: () => ID }) id: string,
    @Args("active", { type: () => Boolean }) active: boolean,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<AppUserType> {
    const updated = await this.appUsersService.setActive(
      id,
      active,
      db,
      toAudit(admin, ctx, ip),
    );
    return { ...updated };
  }
}
