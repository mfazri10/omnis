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
import { ActivityLogService } from "../activity-logs/activity-log.service";
import type { AdminProfile } from "../admins/admins.service";
import { AppsService } from "./apps.service";
import { ProvisionAppInput, UpdateAppInput } from "./dto/app.input";
import { ProvisioningService } from "./provisioning.service";
import { AppContextType } from "./types/app-context.type";
import { AppType } from "./types/app.type";

@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
export class AppsResolver {
  constructor(
    private readonly appsService: AppsService,
    private readonly provisioning: ProvisioningService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Query(() => [AppType])
  @RequirePermissions("platform.apps.view")
  async apps(
    @Args("status", { type: () => String, nullable: true }) status?: string,
    @Args("search", { type: () => String, nullable: true }) search?: string,
  ): Promise<AppType[]> {
    const list = await this.appsService.listApps({
      status: status ?? undefined,
      search: search ?? undefined,
    });
    return list.map((detail) => ({ ...detail }));
  }

  @Query(() => AppType)
  @RequirePermissions("platform.apps.view")
  async app(
    @Args("slug", { type: () => String }) slug: string,
  ): Promise<AppType> {
    const detail = await this.appsService.findBySlugDetailed(slug);
    return { ...detail };
  }

  @Query(() => [AppType])
  async myApps(
    @CurrentAdmin() admin: AdminProfile,
  ): Promise<AppType[]> {
    const list = await this.appsService.listAccessibleApps(admin);
    return list.map((detail) => ({ ...detail }));
  }

  @Query(() => AppContextType)
  @AppScoped()
  appContext(@AppContext() ctx: AppContextData): AppContextType {
    return {
      id: ctx.appId,
      slug: ctx.slug,
      name: ctx.name,
      status: ctx.status,
    };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async provisionApp(
    @Args("input", { type: () => ProvisionAppInput }) input: ProvisionAppInput,
    @CurrentAdmin() actor: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<AppType> {
    const detail = await this.provisioning.provisionApp(input);
    await this.activityLog.record({
      adminId: actor.id,
      appId: null,
      action: "provision",
      entityType: "app",
      entityId: detail.id,
      summary: `Memulai provisioning aplikasi ${detail.name}`,
      ip,
    });
    return { ...detail };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async retryProvisionApp(
    @Args("slug", { type: () => String }) slug: string,
    @CurrentAdmin() actor: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<AppType> {
    const detail = await this.provisioning.retryProvisionApp(slug);
    await this.activityLog.record({
      adminId: actor.id,
      appId: null,
      action: "provision_retry",
      entityType: "app",
      entityId: detail.id,
      summary: `Mengulang provisioning aplikasi ${detail.name}`,
      ip,
    });
    return { ...detail };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async updateApp(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { type: () => UpdateAppInput }) input: UpdateAppInput,
    @CurrentAdmin() actor: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<AppType> {
    const detail = await this.appsService.updateApp(id, input);
    await this.activityLog.record({
      adminId: actor.id,
      appId: null,
      action: "update",
      entityType: "app",
      entityId: detail.id,
      summary: `Mengubah aplikasi ${detail.name}`,
      ip,
    });
    return { ...detail };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async suspendApp(
    @Args("id", { type: () => ID }) id: string,
    @CurrentAdmin() actor: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<AppType> {
    const detail = await this.appsService.suspendApp(id);
    await this.activityLog.record({
      adminId: actor.id,
      appId: null,
      action: "suspend",
      entityType: "app",
      entityId: detail.id,
      summary: `Menangguhkan aplikasi ${detail.name}`,
      ip,
    });
    return { ...detail };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async unsuspendApp(
    @Args("id", { type: () => ID }) id: string,
    @CurrentAdmin() actor: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<AppType> {
    const detail = await this.appsService.unsuspendApp(id);
    await this.activityLog.record({
      adminId: actor.id,
      appId: null,
      action: "unsuspend",
      entityType: "app",
      entityId: detail.id,
      summary: `Mengaktifkan kembali aplikasi ${detail.name}`,
      ip,
    });
    return { ...detail };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async archiveApp(
    @Args("id", { type: () => ID }) id: string,
    @CurrentAdmin() actor: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<AppType> {
    const detail = await this.appsService.archiveApp(id);
    await this.activityLog.record({
      adminId: actor.id,
      appId: null,
      action: "archive",
      entityType: "app",
      entityId: detail.id,
      summary: `Mengarsipkan aplikasi ${detail.name}`,
      ip,
    });
    return { ...detail };
  }

  @Mutation(() => Boolean)
  @RequirePermissions("platform.apps.manage")
  async deleteApp(
    @Args("id", { type: () => ID }) id: string,
    @CurrentAdmin() actor: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    const deleted = await this.appsService.deleteApp(id);
    await this.activityLog.record({
      adminId: actor.id,
      appId: null,
      action: "delete",
      entityType: "app",
      entityId: deleted.id,
      summary: `Menghapus aplikasi ${deleted.name}`,
      ip,
    });
    return true;
  }

  @Mutation(() => Boolean)
  @RequirePermissions("platform.apps.manage")
  async setFcmCredential(
    @Args("appId", { type: () => ID }) appId: string,
    @Args("serviceAccountJson", { type: () => String }) serviceAccountJson: string,
    @CurrentAdmin() actor: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    const detail = await this.appsService.setFcmCredential(
      appId,
      serviceAccountJson,
    );
    await this.activityLog.record({
      adminId: actor.id,
      appId: null,
      action: "update",
      entityType: "app",
      entityId: detail.id,
      summary: `Memperbarui kredensial FCM aplikasi ${detail.name}`,
      ip,
    });
    return true;
  }
}
