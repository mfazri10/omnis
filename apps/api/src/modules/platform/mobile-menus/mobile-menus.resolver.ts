import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AppContext } from "../../../common/decorators/app-context.decorator";
import { AppScoped } from "../../../common/decorators/app-scoped.decorator";
import { ClientIp } from "../../../common/decorators/client-ip.decorator";
import { CurrentAdmin } from "../../../common/decorators/current-admin.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import type { AppContext as AppContextData } from "../../../common/types/request-context";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import type { AdminProfile } from "../admins/admins.service";
import type { MobileMenuRow } from "../entities/mobile-menus.entity";
import {
  CreateMobileMenuInput,
  UpdateMobileMenuInput,
} from "./dto/mobile-menu.input";
import { MobileMenusService } from "./mobile-menus.service";
import { MobileMenuType } from "./types/mobile-menu.type";

function toType(row: MobileMenuRow): MobileMenuType {
  return {
    id: String(row.id),
    appId: String(row.appId),
    name: row.name,
    slug: row.slug,
    routeKey: row.routeKey,
    iconKey: row.iconKey,
    parentId: row.parentId === null ? null : String(row.parentId),
    orderNo: row.orderNo,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
export class MobileMenusResolver {
  constructor(
    private readonly menus: MobileMenusService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Query(() => [MobileMenuType])
  @AppScoped()
  @RequirePermissions("platform.mobile-menus.view")
  async mobileMenus(
    @AppContext() ctx: AppContextData,
  ): Promise<MobileMenuType[]> {
    const rows = await this.menus.list(ctx.appId);
    return rows.map(toType);
  }

  @Mutation(() => MobileMenuType)
  @AppScoped()
  @RequirePermissions("platform.mobile-menus.create")
  async createMobileMenu(
    @AppContext() ctx: AppContextData,
    @Args("input", { type: () => CreateMobileMenuInput })
    input: CreateMobileMenuInput,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<MobileMenuType> {
    const created = await this.menus.create(ctx.appId, input);
    await this.activityLog.record({
      adminId: admin.id,
      appId: ctx.appId,
      action: "create",
      entityType: "mobile_menu",
      entityId: String(created.id),
      summary: `Membuat menu mobile ${created.name}`,
      ip,
    });
    return toType(created);
  }

  @Mutation(() => MobileMenuType)
  @AppScoped()
  @RequirePermissions("platform.mobile-menus.update")
  async updateMobileMenu(
    @AppContext() ctx: AppContextData,
    @Args("input", { type: () => UpdateMobileMenuInput })
    input: UpdateMobileMenuInput,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<MobileMenuType> {
    const updated = await this.menus.update(ctx.appId, input.id, input);
    await this.activityLog.record({
      adminId: admin.id,
      appId: ctx.appId,
      action: "update",
      entityType: "mobile_menu",
      entityId: String(updated.id),
      summary: `Mengubah menu mobile ${updated.name}`,
      ip,
    });
    return toType(updated);
  }

  @Mutation(() => Boolean)
  @AppScoped()
  @RequirePermissions("platform.mobile-menus.delete")
  async deleteMobileMenu(
    @AppContext() ctx: AppContextData,
    @Args("id", { type: () => ID }) id: string,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    const deleted = await this.menus.delete(ctx.appId, id);
    await this.activityLog.record({
      adminId: admin.id,
      appId: ctx.appId,
      action: "delete",
      entityType: "mobile_menu",
      entityId: String(deleted.id),
      summary: `Menghapus menu mobile ${deleted.name}`,
      ip,
    });
    return true;
  }
}
