import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { DatabaseService } from "./database.service";
import { AppDatabaseInterceptor } from "../common/interceptors/app-database.interceptor";

@Global()
@Module({
  providers: [
    DatabaseService,
    { provide: APP_INTERCEPTOR, useClass: AppDatabaseInterceptor },
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
