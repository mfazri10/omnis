import { BadRequestException, UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { ClientIp } from "../../../common/decorators/client-ip.decorator";
import { CurrentAdmin } from "../../../common/decorators/current-admin.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import type { AdminProfile } from "../admins/admins.service";
import type { AssignmentResult } from "./assignments.service";
import { AssignmentsService } from "./assignments.service";
import { CreateRoleInput, UpdateRoleInput } from "./dto/role.input";
import { PermissionsService } from "./permissions.service";
import { PLATFORM_CATALOG } from "./platform.permissions";
import type { RoleScope } from "./roles.repository";
import { RolesService } from "./roles.service";
import { PermissionType } from "./types/permission.type";
import { RoleType } from "./types/role.type";

function assignmentSummary(
  verb: "Menetapkan" | "Mencabut",
  preposition: "ke" | "dari",
  result: AssignmentResult,
): string {
  const appSuffix =
    result.appId === null ? "" : ` untuk aplikasi #${result.appId}`;
  return `${verb} role ${result.roleName} ${preposition} admin #${result.adminId}${appSuffix}`;
}

@Resolver()
@UseGuards(AuthGuard, PermissionGuard)
export class RolesResolver {
  constructor(
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
    private readonly assignments: AssignmentsService,
    private readonly activityLog: ActivityLogService,
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
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<RoleType> {
    const detail = await this.rolesService.create(input);
    await this.activityLog.record({
      adminId: admin.id,
      appId: null,
      action: "create",
      entityType: "role",
      entityId: detail.id,
      summary: `Membuat role ${detail.name}`,
      ip,
    });
    return { ...detail };
  }

  @Mutation(() => RoleType)
  @RequirePermissions("platform.roles.manage")
  async updateRole(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { type: () => UpdateRoleInput }) input: UpdateRoleInput,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<RoleType> {
    const detail = await this.rolesService.update(id, input);
    await this.activityLog.record({
      adminId: admin.id,
      appId: null,
      action: "update",
      entityType: "role",
      entityId: detail.id,
      summary: `Mengubah role ${detail.name}`,
      ip,
    });
    return { ...detail };
  }

  @Mutation(() => Boolean)
  @RequirePermissions("platform.roles.manage")
  async deleteRole(
    @Args("id", { type: () => ID }) id: string,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    const deleted = await this.rolesService.remove(id);
    await this.activityLog.record({
      adminId: admin.id,
      appId: null,
      action: "delete",
      entityType: "role",
      entityId: deleted.id,
      summary: `Menghapus role ${deleted.name}`,
      ip,
    });
    return true;
  }

  @Mutation(() => Boolean)
  @RequirePermissions("platform.roles.manage")
  async assignRole(
    @CurrentAdmin() actor: AdminProfile,
    @ClientIp() ip: string | null,
    @Args("adminId", { type: () => ID }) adminId: string,
    @Args("roleId", { type: () => ID }) roleId: string,
    @Args("appId", { type: () => ID, nullable: true }) appId?: string,
  ): Promise<boolean> {
    const result = await this.assignments.assign({ adminId, roleId, appId });
    await this.activityLog.record({
      adminId: actor.id,
      appId: result.appId,
      action: "assign",
      entityType: "role_assignment",
      entityId: result.roleId,
      summary: assignmentSummary("Menetapkan", "ke", result),
      ip,
    });
    return true;
  }

  @Mutation(() => Boolean)
  @RequirePermissions("platform.roles.manage")
  async unassignRole(
    @CurrentAdmin() actor: AdminProfile,
    @ClientIp() ip: string | null,
    @Args("adminId", { type: () => ID }) adminId: string,
    @Args("roleId", { type: () => ID }) roleId: string,
    @Args("appId", { type: () => ID, nullable: true }) appId?: string,
  ): Promise<boolean> {
    const result = await this.assignments.unassign({ adminId, roleId, appId });
    await this.activityLog.record({
      adminId: actor.id,
      appId: result.appId,
      action: "unassign",
      entityType: "role_assignment",
      entityId: result.roleId,
      summary: assignmentSummary("Mencabut", "dari", result),
      ip,
    });
    return true;
  }

  private parseScope(scope: string): RoleScope {
    if (scope !== "global" && scope !== "app") {
      throw new BadRequestException("Cakupan tidak valid.");
    }
    return scope;
  }
}
