import { Module } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { AppsModule } from "../apps/apps.module";
import { AssignmentsRepository } from "./assignments.repository";
import { PermissionsRepository } from "./permissions.repository";
import { PermissionsService } from "./permissions.service";
import { PLATFORM_CATALOG } from "./platform.permissions";
import { RolesRepository } from "./roles.repository";
import { RolesService } from "./roles.service";

@Module({
  imports: [AppsModule],
  providers: [
    PermissionsRepository,
    PermissionsService,
    RolesRepository,
    RolesService,
    AssignmentsRepository,
  ],
  exports: [
    PermissionsRepository,
    PermissionsService,
    RolesRepository,
    RolesService,
    AssignmentsRepository,
  ],
})
export class RbacModule implements OnModuleInit {
  constructor(private readonly permissions: PermissionsService) {}

  async onModuleInit(): Promise<void> {
    await this.permissions.syncCatalog(PLATFORM_CATALOG);
  }
}
