import { Module } from "@nestjs/common";
import { AppsRepository } from "./apps.repository";
import { AppsResolver } from "./apps.resolver";

/**
 * Modul minimal F05 (R1): repository baca + satu query daftar.
 * CRUD/provisioning/FCM/UI milik F03.
 */
@Module({
  providers: [AppsRepository, AppsResolver],
  exports: [AppsRepository],
})
export class AppsModule {}
