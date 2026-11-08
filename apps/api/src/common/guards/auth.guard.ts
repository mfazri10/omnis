import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthService } from "../../auth/auth.service";
import type { GraphqlContext } from "../types/request-context";

export const ADMIN_KEY = "admin";

function toHeaderRecord(headers: unknown): Record<string, string> {
  if (typeof headers !== "object" || headers === null) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let req: Record<string, unknown>;
    if (context.getType<string>() === "graphql") {
      req = GqlExecutionContext.create(context).getContext<GraphqlContext>()
        .req;
    } else {
      req = context.switchToHttp().getRequest<Record<string, unknown>>();
    }
    const verified = await this.authService.verifySession(
      toHeaderRecord(req.headers),
    );
    if (!verified) {
      throw new UnauthorizedException(
        "Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.",
      );
    }
    req[ADMIN_KEY] = verified.admin;
    return true;
  }
}
