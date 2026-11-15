import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import { RbacService } from "../../modules/platform/rbac/rbac.service";
import type { GraphqlContext } from "../types/request-context";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { ADMIN_KEY } from "./auth.guard";

interface AdminProfileLike {
  id: string;
  isSuperAdmin: boolean;
}

/**
 * Menegakkan @RequirePermissions (doc 04 §5). Berjalan setelah AuthGuard
 * yang menulis profil ke req[ADMIN_KEY]. Konteks app (F02) belum ada —
 * semua operasi F05 global sehingga appId tak diteruskan.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }
    const admin = this.readAdmin(context);
    if (!admin) {
      throw new UnauthorizedException(
        "Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.",
      );
    }
    for (const key of required) {
      const allowed = await this.rbac.hasPermission(
        { id: admin.id, isSuperAdmin: admin.isSuperAdmin },
        key,
      );
      if (!allowed) {
        throw new ForbiddenException({
          message: "Anda tidak memiliki akses untuk tindakan ini.",
          requiredPermission: key,
        });
      }
    }
    return true;
  }

  private readAdmin(context: ExecutionContext): AdminProfileLike | null {
    let req: Record<string, unknown>;
    if (context.getType<string>() === "graphql") {
      req = GqlExecutionContext.create(context).getContext<GraphqlContext>()
        .req;
    } else {
      req = context.switchToHttp().getRequest<Record<string, unknown>>();
    }
    const admin: unknown = req[ADMIN_KEY];
    if (
      typeof admin !== "object" ||
      admin === null ||
      !("id" in admin) ||
      typeof admin.id !== "string"
    ) {
      return null;
    }
    return {
      id: admin.id,
      isSuperAdmin:
        "isSuperAdmin" in admin && admin.isSuperAdmin === true,
    };
  }
}
