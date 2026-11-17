import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
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
import {
  CampaignPageArgs,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "./dto/campaign.input";
import type { CampaignAuditContext } from "./notifications.service";
import { NotificationsService } from "./notifications.service";
import {
  CampaignConnection,
  CampaignType,
} from "./types/campaign.type";

function toAudit(
  admin: AdminProfile,
  ip: string | null,
): CampaignAuditContext {
  return { adminId: admin.id, ip };
}

@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => CampaignConnection)
  @AppScoped()
  @RequirePermissions("platform.notifications.view")
  async campaigns(
    @Args() args: CampaignPageArgs,
    @AppContext() ctx: AppContextData,
  ): Promise<CampaignConnection> {
    const filter = args.filter;
    const { items, total } = await this.notificationsService.list(ctx.appId, {
      filter: {
        status: filter?.status,
        search: filter?.search,
      },
      page: args.page,
      perPage: args.perPage,
    });
    const connection = new CampaignConnection();
    connection.items = items.map((item): CampaignType => ({ ...item }));
    connection.total = total;
    return connection;
  }

  @Query(() => CampaignType)
  @AppScoped()
  @RequirePermissions("platform.notifications.view")
  async campaign(
    @Args("id", { type: () => ID }) id: string,
    @AppContext() ctx: AppContextData,
  ): Promise<CampaignType> {
    const item = await this.notificationsService.getById(id, ctx.appId);
    return { ...item };
  }

  @Mutation(() => CampaignType)
  @AppScoped()
  @RequirePermissions("platform.notifications.send")
  async createCampaign(
    @Args("input", { type: () => CreateCampaignInput })
    input: CreateCampaignInput,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CampaignType> {
    const created = await this.notificationsService.createCampaign(
      ctx.appId,
      input,
      toAudit(admin, ip),
    );
    return { ...created };
  }

  @Mutation(() => CampaignType)
  @AppScoped()
  @RequirePermissions("platform.notifications.send")
  async updateCampaign(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { type: () => UpdateCampaignInput })
    input: UpdateCampaignInput,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CampaignType> {
    const updated = await this.notificationsService.updateCampaign(
      id,
      ctx.appId,
      input,
      toAudit(admin, ip),
    );
    return { ...updated };
  }

  @Mutation(() => CampaignType)
  @AppScoped()
  @RequirePermissions("platform.notifications.send")
  async sendCampaignNow(
    @Args("id", { type: () => ID }) id: string,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CampaignType> {
    const sent = await this.notificationsService.sendCampaignNow(
      id,
      ctx.appId,
      toAudit(admin, ip),
    );
    return { ...sent };
  }

  @Mutation(() => CampaignType)
  @AppScoped()
  @RequirePermissions("platform.notifications.send")
  async cancelCampaign(
    @Args("id", { type: () => ID }) id: string,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CampaignType> {
    const cancelled = await this.notificationsService.cancelCampaign(
      id,
      ctx.appId,
      toAudit(admin, ip),
    );
    return { ...cancelled };
  }
}
