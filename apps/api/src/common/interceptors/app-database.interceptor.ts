import { Injectable } from "@nestjs/common";
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import type { Observable } from "rxjs";
import { DatabaseService } from "../../database/database.service";
import type { GraphqlContext } from "../types/request-context";
import { APP_CONTEXT_KEY } from "../types/request-context";

export const APP_DB_KEY = "appDb";

/**
 * Resolve koneksi App DB dari konteks tervalidasi AppContextGuard (doc 11).
 * Header mentah tidak pernah dibaca: operasi global (tanpa konteks)
 * dilewati apa adanya.
 */
@Injectable()
export class AppDatabaseInterceptor implements NestInterceptor {
  constructor(private readonly databaseService: DatabaseService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (context.getType<string>() !== "graphql") {
      return next.handle();
    }
    const gqlCtx = GqlExecutionContext.create(context);
    const req = gqlCtx.getContext<GraphqlContext>().req;
    const slug = this.readSlug(req);

    if (slug !== null) {
      req[APP_DB_KEY] = await this.databaseService.getAppConnection(slug);
    }

    return next.handle();
  }

  private readSlug(req: GraphqlContext["req"]): string | null {
    const ctx: unknown = req[APP_CONTEXT_KEY];
    if (typeof ctx !== "object" || ctx === null || !("slug" in ctx)) {
      return null;
    }
    const slug: unknown = ctx.slug;
    return typeof slug === "string" && slug.length > 0 ? slug : null;
  }
}
