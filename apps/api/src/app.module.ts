import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { APP_FILTER } from "@nestjs/core";
import { join } from "node:path";
import { validateEnv } from "./config/env.validation";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { HealthModule } from "./health/health.module";
import { MetaModule } from "./meta/meta.module";
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
    RedisModule,
    HealthModule,
    MetaModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: GraphqlExceptionFilter }],
})
export class AppModule {}
