import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AppContext } from "../../../common/decorators/app-context.decorator";
import type { AppContext as AppContextData } from "../../../common/types/request-context";
import { AppScoped } from "../../../common/decorators/app-scoped.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../../common/guards/app-context.guard";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { AppConfigService } from "./app-config.service";
import { UpdateAppConfigInput } from "./dto/app-config.input";
import { AppConfigType } from "./types/app-config.type";

@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
export class AppConfigResolver {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Query(() => AppConfigType)
  @AppScoped()
  @RequirePermissions("platform.app-config.view")
  async appConfig(
    @AppContext() ctx: AppContextData,
  ): Promise<AppConfigType> {
    const effective = await this.appConfigService.getEffectiveConfig(
      ctx.appId,
    );
    return { ...effective };
  }

  @Mutation(() => AppConfigType)
  @AppScoped()
  @RequirePermissions("platform.app-config.manage")
  async updateAppConfig(
    @AppContext() ctx: AppContextData,
    @Args("input", { type: () => UpdateAppConfigInput })
    input: UpdateAppConfigInput,
  ): Promise<AppConfigType> {
    const effective = await this.appConfigService.updateConfig(
      ctx.appId,
      input,
    );
    return { ...effective };
  }
}
