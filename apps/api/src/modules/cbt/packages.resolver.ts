import { UseGuards, UseInterceptors } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AppContext } from "../../common/decorators/app-context.decorator";
import type { AppContext as AppContextData } from "../../common/types/request-context";
import { AppDb } from "../../common/decorators/app-db.decorator";
import { AppScoped } from "../../common/decorators/app-scoped.decorator";
import { ClientIp } from "../../common/decorators/client-ip.decorator";
import { CurrentAdmin } from "../../common/decorators/current-admin.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { AppContextGuard } from "../../common/guards/app-context.guard";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import type { Db } from "../../database/database.service";
import type { AdminProfile } from "../platform/admins/admins.service";
import { CbtTablesInterceptor } from "./cbt-tables.interceptor";
import type { CbtAuditContext } from "./questions.service";
import {
  CbtPackagePageArgs,
  CreateCbtPackageInput,
  SetCbtPackageQuestionsArgs,
  UpdateCbtPackageInput,
} from "./dto/package.input";
import { CbtPackagesService } from "./packages.service";
import {
  CbtPackageConnection,
  CbtPackageDetailType,
  CbtPackageType,
} from "./types/package.type";

function toAudit(
  admin: AdminProfile,
  ctx: AppContextData,
  ip: string | null,
): CbtAuditContext {
  return { adminId: admin.id, appId: ctx.appId, ip };
}

@Resolver()
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
@UseInterceptors(CbtTablesInterceptor)
export class CbtPackagesResolver {
  constructor(private readonly packages: CbtPackagesService) {}

  @Query(() => CbtPackageConnection)
  @AppScoped()
  @RequirePermissions("cbt.packages.view")
  async cbtPackages(
    @Args() args: CbtPackagePageArgs,
    @AppDb() db: Db,
  ): Promise<CbtPackageConnection> {
    const filter = args.filter;
    const { items, total } = await this.packages.list(
      {
        filter: { search: filter?.search, isActive: filter?.isActive },
        page: args.page,
        perPage: args.perPage,
      },
      db,
    );
    const connection = new CbtPackageConnection();
    connection.items = items.map((item): CbtPackageType => ({ ...item }));
    connection.total = total;
    return connection;
  }

  @Query(() => CbtPackageDetailType)
  @AppScoped()
  @RequirePermissions("cbt.packages.view")
  async cbtPackage(
    @Args("id", { type: () => ID }) id: string,
    @AppDb() db: Db,
  ): Promise<CbtPackageDetailType> {
    return { ...(await this.packages.getDetail(id, db)) };
  }

  @Mutation(() => CbtPackageType)
  @AppScoped()
  @RequirePermissions("cbt.packages.manage")
  async createCbtPackage(
    @Args("input", { type: () => CreateCbtPackageInput })
    input: CreateCbtPackageInput,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CbtPackageType> {
    const created = await this.packages.create(input, db, toAudit(admin, ctx, ip));
    return { ...created };
  }

  @Mutation(() => CbtPackageType)
  @AppScoped()
  @RequirePermissions("cbt.packages.manage")
  async updateCbtPackage(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { type: () => UpdateCbtPackageInput })
    input: UpdateCbtPackageInput,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CbtPackageType> {
    const updated = await this.packages.update(id, input, db, toAudit(admin, ctx, ip));
    return { ...updated };
  }

  @Mutation(() => CbtPackageDetailType)
  @AppScoped()
  @RequirePermissions("cbt.packages.manage")
  async setCbtPackageQuestions(
    @Args() args: SetCbtPackageQuestionsArgs,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CbtPackageDetailType> {
    return {
      ...(await this.packages.setQuestions(
        args.id,
        args.questionIds,
        db,
        toAudit(admin, ctx, ip),
      )),
    };
  }
}
