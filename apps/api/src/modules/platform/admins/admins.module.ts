import { Module } from "@nestjs/common";
import { AdminsRepository } from "./admins.repository";
import { AdminsService } from "./admins.service";

@Module({
  providers: [AdminsRepository, AdminsService],
  exports: [AdminsRepository, AdminsService],
})
export class AdminsModule {}
