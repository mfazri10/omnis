import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { APP_FILTER } from "@nestjs/core";
import { join } from "node:path";
import { validateEnv } from "./config/env.validation";
import { AuthModule } from "./auth/auth.module";
import { AppsModule } from "./modules/platform/apps/apps.module";
import { ActivityLogsModule } from "./modules/platform/activity-logs/activity-logs.module";
import { AppConfigModule } from "./modules/platform/app-config/app-config.module";
import { AppUsersModule } from "./modules/platform/app-users/app-users.module";
import { MediaModule } from "./modules/platform/media/media.module";
import { AdminsModule } from "./modules/platform/admins/admins.module";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { HealthModule } from "./health/health.module";
import { MetaModule } from "./meta/meta.module";
import { RbacModule } from "./modules/platform/rbac/rbac.module";
import { GraphqlExceptionFilter } from "./common/filters/graphql-exception.filter";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "src/schema.gql"),
      sortSchema: true,
      playground: process.env.NODE_ENV !== "production",
      introspection: process.env.NODE_ENV !== "production",
    }),
    DatabaseModule,
    ActivityLogsModule,
    AppsModule,
    AppConfigModule,
    AppUsersModule,
    MediaModule,
    AdminsModule,
    RedisModule,
    HealthModule,
    MetaModule,
    AuthModule,
    RbacModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: GraphqlExceptionFilter }],
})
export class AppModule {}
