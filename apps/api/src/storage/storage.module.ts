import { Module } from "@nestjs/common";
import { LocalStorageDriver } from "./local-storage.driver";
import { STORAGE_DRIVER } from "./storage.driver";

@Module({
  providers: [
    LocalStorageDriver,
    { provide: STORAGE_DRIVER, useExisting: LocalStorageDriver },
  ],
  exports: [STORAGE_DRIVER, LocalStorageDriver],
})
export class StorageModule {}
