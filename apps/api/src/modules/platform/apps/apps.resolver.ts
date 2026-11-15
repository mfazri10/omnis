import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { AppsService } from "./apps.service";
import { ProvisionAppInput, UpdateAppInput } from "./dto/app.input";
import { ProvisioningService } from "./provisioning.service";
import { AppType } from "./types/app.type";

@Resolver()
@UseGuards(AuthGuard, PermissionGuard)
export class AppsResolver {
  constructor(
    private readonly appsService: AppsService,
    private readonly provisioning: ProvisioningService,
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

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async provisionApp(
    @Args("input", { type: () => ProvisionAppInput }) input: ProvisionAppInput,
  ): Promise<AppType> {
    const detail = await this.provisioning.provisionApp(input);
    return { ...detail };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async retryProvisionApp(
    @Args("slug", { type: () => String }) slug: string,
  ): Promise<AppType> {
    const detail = await this.provisioning.retryProvisionApp(slug);
    return { ...detail };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async updateApp(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { type: () => UpdateAppInput }) input: UpdateAppInput,
  ): Promise<AppType> {
    const detail = await this.appsService.updateApp(id, input);
    return { ...detail };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async suspendApp(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<AppType> {
    const detail = await this.appsService.suspendApp(id);
    return { ...detail };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async unsuspendApp(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<AppType> {
    const detail = await this.appsService.unsuspendApp(id);
    return { ...detail };
  }

  @Mutation(() => AppType)
  @RequirePermissions("platform.apps.manage")
  async archiveApp(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<AppType> {
    const detail = await this.appsService.archiveApp(id);
    return { ...detail };
  }

  @Mutation(() => Boolean)
  @RequirePermissions("platform.apps.manage")
  async deleteApp(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.appsService.deleteApp(id);
    return true;
  }

  @Mutation(() => Boolean)
  @RequirePermissions("platform.apps.manage")
  async setFcmCredential(
    @Args("appId", { type: () => ID }) appId: string,
    @Args("serviceAccountJson", { type: () => String }) serviceAccountJson: string,
  ): Promise<boolean> {
    await this.appsService.setFcmCredential(appId, serviceAccountJson);
    return true;
  }
}
