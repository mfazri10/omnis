import { UseGuards } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AuthService } from "../../../auth/auth.service";
import { CurrentAdmin } from "../../../common/decorators/current-admin.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { PaginationArgs } from "../../../common/types/pagination";
import { AssignmentsService } from "../rbac/assignments.service";
import { RbacService } from "../rbac/rbac.service";
import { RoleAssignmentType } from "../rbac/types/assignment.type";
import { AdminsService } from "./admins.service";
import type { AdminListItem, AdminProfile } from "./admins.service";
import { CreateAdminInput, UpdateAdminInput } from "./dto/admin.input";
import { AdminConnection, AdminType } from "./types/admin.type";

function toAdminType(item: AdminListItem | AdminProfile): AdminType {
  // createAdminAccount tak mengembalikan isActive; akun baru selalu aktif (default DB true).
  const isActive = "isActive" in item ? item.isActive : true;
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    isSuperAdmin: item.isSuperAdmin,
    isActive,
  };
}

@Resolver()
@UseGuards(AuthGuard, PermissionGuard)
export class AdminsResolver {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly auth: AuthService,
    private readonly rbac: RbacService,
    private readonly assignments: AssignmentsService,
  ) {}

  @Query(() => AdminConnection)
  @RequirePermissions("platform.admins.view")
  async admins(
    @Args({ type: () => PaginationArgs }) pagination: PaginationArgs,
    @Args("search", { type: () => String, nullable: true }) search?: string,
  ): Promise<AdminConnection> {
    const { items, totalCount } = await this.adminsService.listAdmins({
      search: search ?? undefined,
      skip: pagination.skip,
      take: pagination.take,
    });
    const connection = new AdminConnection();
    connection.items = items.map(toAdminType);
    connection.totalCount = totalCount;
    return connection;
  }

  @Query(() => AdminType)
  @RequirePermissions("platform.admins.view")
  async admin(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<AdminType> {
    return toAdminType(await this.adminsService.findById(id));
  }

  @Query(() => AdminType)
  async currentAdmin(
    @CurrentAdmin() admin: AdminProfile,
  ): Promise<AdminType> {
    return toAdminType(await this.adminsService.findById(admin.id));
  }

  @Query(() => [String])
  @RequirePermissions("platform.admins.view")
  async effectivePermissions(
    @Args("adminId", { type: () => ID }) adminId: string,
    @Args("appId", { type: () => ID, nullable: true }) appId?: string,
  ): Promise<string[]> {
    await this.adminsService.findById(adminId);
    return this.rbac.listEffectivePermissions(adminId, appId ?? undefined);
  }

  @Query(() => [RoleAssignmentType])
  @RequirePermissions("platform.admins.view")
  async adminAssignments(
    @Args("adminId", { type: () => ID }) adminId: string,
  ): Promise<RoleAssignmentType[]> {
    await this.adminsService.findById(adminId);
    return this.assignments.listDetailedByAdmin(adminId);
  }

  @Mutation(() => AdminType)
  @RequirePermissions("platform.admins.manage")
  async createAdmin(
    @Args("input", { type: () => CreateAdminInput }) input: CreateAdminInput,
  ): Promise<AdminType> {
    const profile = await this.auth.createAdminAccount({
      name: input.name,
      email: input.email,
      password: input.password,
      isSuperAdmin: false,
    });
    return toAdminType(profile);
  }

  @Mutation(() => AdminType)
  @RequirePermissions("platform.admins.manage")
  async updateAdmin(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { type: () => UpdateAdminInput }) input: UpdateAdminInput,
  ): Promise<AdminType> {
    return toAdminType(await this.adminsService.updateAdmin(id, input));
  }

  @Mutation(() => AdminType)
  @RequirePermissions("platform.admins.manage")
  async setAdminActive(
    @Args("id", { type: () => ID }) id: string,
    @Args("active", { type: () => Boolean }) active: boolean,
  ): Promise<AdminType> {
    return toAdminType(await this.adminsService.setAdminActive(id, active));
  }
}
