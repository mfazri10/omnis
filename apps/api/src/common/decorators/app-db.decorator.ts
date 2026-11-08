import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import type { Db } from "../../database/database.service";
import { APP_DB_KEY } from "../interceptors/app-database.interceptor";
import type { GraphqlContext } from "../types/request-context";

function getRequest(context: ExecutionContext): Record<string, unknown> {
  const gqlCtx = GqlExecutionContext.create(context);
  return gqlCtx.getContext<GraphqlContext>().req;
}

/** Koneksi App DB dari konteks request (diisi AppDatabaseInterceptor). */
export const AppDb = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Db => {
    return getRequest(context)[APP_DB_KEY] as Db;
  },
);
