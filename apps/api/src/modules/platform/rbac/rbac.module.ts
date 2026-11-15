import { Global, Module } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { AppsModule } from "../apps/apps.module";
import { AssignmentsRepository } from "./assignments.repository";
import { AssignmentsService } from "./assignments.service";
import { PermissionsRepository } from "./permissions.repository";
import { PermissionsService } from "./permissions.service";
import { PLATFORM_CATALOG } from "./platform.permissions";
import { RbacService } from "./rbac.service";
import { RolesRepository } from "./roles.repository";
import { RolesResolver } from "./roles.resolver";
import { RolesService } from "./roles.service";

// Global: PermissionGuard dipakai semua modul domain (preseden AuthModule F01).
@Global()
@Module({
  imports: [AppsModule],
  providers: [
    PermissionsRepository,
    PermissionsService,
    RolesRepository,
    RolesService,
    AssignmentsRepository,
    AssignmentsService,
    RbacService,
    PermissionGuard,
    RolesResolver,
  ],
  exports: [
    PermissionsRepository,
    PermissionsService,
    RolesRepository,
    RolesService,
    AssignmentsRepository,
    AssignmentsService,
    RbacService,
    PermissionGuard,
  ],
})
export class RbacModule implements OnModuleInit {
  constructor(private readonly permissions: PermissionsService) {}

  async onModuleInit(): Promise<void> {
    await this.permissions.syncCatalog(PLATFORM_CATALOG);
  }
}
