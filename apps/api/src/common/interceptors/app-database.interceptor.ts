import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { Observable } from "rxjs";
import { DatabaseService } from "../../database/database.service";
import type { GraphqlContext } from "../types/request-context";

export const APP_DB_KEY = "appDb";
const APP_SLUG_HEADER = "x-app-slug";

/**
 * Resolve koneksi App DB dari header X-App-Slug (doc 11).
 * Guard otorisasi (F01/F05) menyusul; interceptor ini hanya menyiapkan koneksi.
 */
@Injectable()
export class AppDatabaseInterceptor implements NestInterceptor {
  constructor(private readonly databaseService: DatabaseService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const gqlCtx = GqlExecutionContext.create(context);
    const req = gqlCtx.getContext<GraphqlContext>().req;
    const rawSlug = req.headers?.[APP_SLUG_HEADER];

    if (typeof rawSlug === "string" && rawSlug.length > 0) {
      req[APP_DB_KEY] =
        await this.databaseService.getAppConnection(rawSlug);
    }

    return next.handle();
  }
}
