import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import type { AdminProfile } from "../../modules/platform/admins/admins.service";
import type { GraphqlContext } from "../types/request-context";
import { ADMIN_KEY } from "../guards/auth.guard";

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminProfile => {
    if (context.getType<string>() === "graphql") {
      const req =
        GqlExecutionContext.create(context).getContext<GraphqlContext>().req;
      return req[ADMIN_KEY] as AdminProfile;
    }
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    return req[ADMIN_KEY] as AdminProfile;
  },
);
