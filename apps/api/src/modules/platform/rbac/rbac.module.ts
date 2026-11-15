import { Module } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { PermissionsRepository } from "./permissions.repository";
import { PermissionsService } from "./permissions.service";
import { PLATFORM_CATALOG } from "./platform.permissions";

@Module({
  providers: [PermissionsRepository, PermissionsService],
  exports: [PermissionsRepository, PermissionsService],
})
export class RbacModule implements OnModuleInit {
  constructor(private readonly permissions: PermissionsService) {}

  async onModuleInit(): Promise<void> {
    await this.permissions.syncCatalog(PLATFORM_CATALOG);
  }
}
