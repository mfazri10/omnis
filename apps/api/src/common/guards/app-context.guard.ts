import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import { DatabaseService } from "../../database/database.service";
import { AppsRepository } from "../../modules/platform/apps/apps.repository";
import { AssignmentsRepository } from "../../modules/platform/rbac/assignments.repository";
import { APP_SCOPED_KEY } from "../decorators/app-scoped.decorator";
import {
  AppNotFoundException,
  AppSuspendedException,
} from "../exceptions/app.exceptions";
import type { GraphqlContext, GraphqlRequest } from "../types/request-context";
import { APP_CONTEXT_KEY } from "../types/request-context";
import { ADMIN_KEY } from "./auth.guard";

const APP_SLUG_HEADER = "x-app-slug";

interface AdminProfileLike {
  id: string;
  isSuperAdmin: boolean;
}

/**
 * Memvalidasi konteks aplikasi untuk operasi @AppScoped (doc 05 §4.1).
 * Berjalan setelah AuthGuard (butuh req[ADMIN_KEY]), sebelum
 * PermissionGuard (menulis req[APP_CONTEXT_KEY]). Operasi global
 * (tanpa marker) lolos tanpa menyentuh header.
 */
@Injectable()
export class AppContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
    private readonly apps: AppsRepository,
    private readonly assignments: AssignmentsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scoped = this.reflector.getAllAndOverride<boolean>(
      APP_SCOPED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (scoped !== true) {
      return true;
    }
    const req = this.readRequest(context);
    const admin = this.readAdmin(req);
    if (!admin) {
      throw new UnauthorizedException(
        "Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.",
      );
    }
    const slug = this.readSlug(req);
    if (!slug) {
      throw new BadRequestException(
        "Konteks aplikasi wajib diisi (header X-App-Slug).",
      );
    }
    const db = this.database.getControlPlaneConnection();
    const row = await this.apps.findBySlug(db, slug);
    if (!row) {
      throw new AppNotFoundException(slug);
    }
    if (row.status !== "active") {
      const manageable = row.status === "suspended" && admin.isSuperAdmin;
      if (!manageable) {
        throw new AppSuspendedException(slug, row.status);
      }
    }
    if (!admin.isSuperAdmin) {
      const adminId = Number(admin.id);
      if (!Number.isInteger(adminId) || adminId <= 0) {
        throw new UnauthorizedException(
          "Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.",
        );
      }
      const grants = await this.assignments.listByAdmin(db, adminId);
      const allowed = grants.some(
        (grant) =>
          grant.scopeType === "global" || grant.appId === row.id,
      );
      if (!allowed) {
        throw new ForbiddenException(
          "Anda tidak memiliki akses ke aplikasi ini.",
        );
      }
    }
    req[APP_CONTEXT_KEY] = {
      appId: String(row.id),
      slug: row.slug,
      name: row.name,
      status: row.status,
      dbName: row.dbName,
    };
    return true;
  }

  private readRequest(context: ExecutionContext): GraphqlRequest {
    if (context.getType<string>() === "graphql") {
      return GqlExecutionContext.create(context).getContext<GraphqlContext>()
        .req;
    }
    return context.switchToHttp().getRequest<GraphqlRequest>();
  }

  private readAdmin(
    req: Record<string, unknown>,
  ): AdminProfileLike | null {
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

  private readSlug(req: Record<string, unknown>): string | null {
    const headers: unknown = req.headers;
    if (typeof headers !== "object" || headers === null) {
      return null;
    }
    const raw: unknown = (headers as Record<string, unknown>)[
      APP_SLUG_HEADER
    ];
    if (typeof raw !== "string" || raw.length === 0) {
      return null;
    }
    return raw;
  }
}
