import { Module } from "@nestjs/common";
import { AdminsRepository } from "./admins.repository";
import { AdminsService } from "./admins.service";
import { RbacModule } from "../rbac/rbac.module";

@Module({
  imports: [RbacModule],
  providers: [AdminsRepository, AdminsService],
  exports: [AdminsRepository, AdminsService],
})
export class AdminsModule {}
