import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3StorageDriver } from "./s3-storage.driver";
import { LocalStorageDriver } from "./local-storage.driver";
import { STORAGE_DRIVER } from "./storage.driver";

@Module({
  providers: [
    LocalStorageDriver,
    {
      provide: STORAGE_DRIVER,
      useFactory: (
        config: ConfigService,
        local: LocalStorageDriver,
      ) => {
        const driver = config.get<string>("STORAGE_DRIVER") ?? "local";
        if (driver === "local") return local;
        if (driver === "s3") return new S3StorageDriver(config);
        throw new Error(`STORAGE_DRIVER tidak dikenal: ${driver}`);
      },
      inject: [ConfigService, LocalStorageDriver],
    },
  ],
  exports: [STORAGE_DRIVER, LocalStorageDriver],
})
export class StorageModule {}
