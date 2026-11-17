import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import type { GraphqlContext } from "../types/request-context";

interface IpRequestShape {
  headers?: Record<string, unknown>;
  ip?: unknown;
}

function firstNonEmpty(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed !== "") {
      return trimmed;
    }
  }
  return null;
}

/**
 * IP klien: hormati `x-forwarded-for` (entri pertama) lalu `req.ip`.
 * Nilai mentah selalu di-trim; null bila tak ada yang valid.
 */
export function extractClientIp(req: IpRequestShape): string | null {
  const forwarded = req.headers?.["x-forwarded-for"];
  const fromHeader =
    typeof forwarded === "string"
      ? firstNonEmpty(forwarded.split(","))
      : Array.isArray(forwarded)
        ? firstNonEmpty(forwarded)
        : null;
  if (fromHeader !== null) {
    return fromHeader;
  }
  return typeof req.ip === "string" ? (firstNonEmpty([req.ip]) ?? null) : null;
}

export const ClientIp = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    if (context.getType<string>() === "graphql") {
      const req =
        GqlExecutionContext.create(context).getContext<GraphqlContext>().req;
      return extractClientIp(req);
    }
    const req = context
      .switchToHttp()
      .getRequest<IpRequestShape & Record<string, unknown>>();
    return extractClientIp(req);
  },
);
