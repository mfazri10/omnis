import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import type {
  AppContext as AppContextData,
  GraphqlContext,
} from "../types/request-context";
import { APP_CONTEXT_KEY } from "../types/request-context";

/** Konteks aplikasi tervalidasi (ditulis AppContextGuard). */
export const AppContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AppContextData => {
    if (context.getType<string>() === "graphql") {
      const req =
        GqlExecutionContext.create(context).getContext<GraphqlContext>().req;
      return req[APP_CONTEXT_KEY] as AppContextData;
    }
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    return req[APP_CONTEXT_KEY] as AppContextData;
  },
);
