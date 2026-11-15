import { BadRequestException, UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { AssignmentsService } from "./assignments.service";
import { CreateRoleInput, UpdateRoleInput } from "./dto/role.input";
import { PermissionsService } from "./permissions.service";
import { PLATFORM_CATALOG } from "./platform.permissions";
import type { RoleScope } from "./roles.repository";
import { RolesService } from "./roles.service";
import { PermissionType } from "./types/permission.type";
import { RoleType } from "./types/role.type";

@Resolver()
@UseGuards(AuthGuard, PermissionGuard)
export class RolesResolver {
  constructor(
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
    private readonly assignments: AssignmentsService,
  ) {}

  @Query(() => [RoleType])
  @RequirePermissions("platform.roles.view")
  async roles(
    @Args("scope", { type: () => String, nullable: true }) scope?: string,
    @Args("appId", { type: () => ID, nullable: true }) appId?: string,
  ): Promise<RoleType[]> {
    const list = await this.rolesService.list(
      scope === undefined ? undefined : this.parseScope(scope),
      appId ?? undefined,
    );
    return list.map((detail) => ({ ...detail }));
  }

  @Query(() => [PermissionType])
  @RequirePermissions("platform.roles.view")
  async permissions(
    @Args("module", { type: () => String, nullable: true }) module?: string,
  ): Promise<PermissionType[]> {
    const rows = await this.permissionsService.listByModule(module ?? undefined);
    const sensitivity = new Map(
      PLATFORM_CATALOG.map((def) => [def.key, def.globalOnly]),
    );
    return rows.map((row) => ({
      id: String(row.id),
      key: row.key,
      module: row.module,
      label: row.label,
      description: row.description,
      globalOnly: sensitivity.get(row.key) ?? false,
    }));
  }

  @Mutation(() => RoleType)
  @RequirePermissions("platform.roles.manage")
  async createRole(
    @Args("input", { type: () => CreateRoleInput }) input: CreateRoleInput,
  ): Promise<RoleType> {
    const detail = await this.rolesService.create(input);
    return { ...detail };
  }

  @Mutation(() => RoleType)
  @RequirePermissions("platform.roles.manage")
  async updateRole(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { type: () => UpdateRoleInput }) input: UpdateRoleInput,
  ): Promise<RoleType> {
    const detail = await this.rolesService.update(id, input);
    return { ...detail };
  }

  @Mutation(() => Boolean)
  @RequirePermissions("platform.roles.manage")
  async deleteRole(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.rolesService.remove(id);
    return true;
  }

  @Mutation(() => Boolean)
  @RequirePermissions("platform.roles.manage")
  async assignRole(
    @Args("adminId", { type: () => ID }) adminId: string,
    @Args("roleId", { type: () => ID }) roleId: string,
    @Args("appId", { type: () => ID, nullable: true }) appId?: string,
  ): Promise<boolean> {
    await this.assignments.assign({ adminId, roleId, appId });
    return true;
  }

  @Mutation(() => Boolean)
  @RequirePermissions("platform.roles.manage")
  async unassignRole(
    @Args("adminId", { type: () => ID }) adminId: string,
    @Args("roleId", { type: () => ID }) roleId: string,
    @Args("appId", { type: () => ID, nullable: true }) appId?: string,
  ): Promise<boolean> {
    await this.assignments.unassign({ adminId, roleId, appId });
    return true;
  }

  private parseScope(scope: string): RoleScope {
    if (scope !== "global" && scope !== "app") {
      throw new BadRequestException("Cakupan tidak valid.");
    }
    return scope;
  }
}
