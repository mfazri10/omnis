import { Module } from "@nestjs/common";
import { AppsRepository } from "./apps.repository";

/** Modul minimal F05 (R1): hanya export repository baca. Service/resolver/UI milik F03. */
@Module({
  providers: [AppsRepository],
  exports: [AppsRepository],
})
export class AppsModule {}
