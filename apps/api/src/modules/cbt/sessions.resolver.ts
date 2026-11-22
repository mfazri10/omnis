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
  CbtResultPageArgs,
  CbtSessionPageArgs,
  StartCbtSimulationInput,
  SubmitCbtAnswersArgs,
} from "./dto/session.input";
import { CbtSessionsService } from "./sessions.service";
import {
  CbtPackageStatsType,
  CbtResultConnection,
  CbtSessionConnection,
  CbtSessionDetailType,
} from "./types/session.type";

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
export class CbtSessionsResolver {
  constructor(private readonly sessions: CbtSessionsService) {}

  @Query(() => CbtSessionConnection)
  @AppScoped()
  @RequirePermissions("cbt.sessions.view")
  async cbtSessions(
    @Args() args: CbtSessionPageArgs,
    @AppDb() db: Db,
  ): Promise<CbtSessionConnection> {
    const filter = args.filter;
    const { items, total } = await this.sessions.listSessions(
      {
        filter: {
          packageId:
            filter?.packageId === undefined ? undefined : Number(filter.packageId),
          status: filter?.status,
          search: filter?.search,
        },
        page: args.page,
        perPage: args.perPage,
      },
      db,
    );
    const connection = new CbtSessionConnection();
    connection.items = items;
    connection.total = total;
    return connection;
  }

  @Query(() => CbtSessionDetailType)
  @AppScoped()
  @RequirePermissions("cbt.sessions.view")
  async cbtSession(
    @Args("id", { type: () => ID }) id: string,
    @AppDb() db: Db,
  ): Promise<CbtSessionDetailType> {
    return this.sessions.getDetail(id, db);
  }

  @Mutation(() => CbtSessionDetailType)
  @AppScoped()
  @RequirePermissions("cbt.sessions.manage")
  async startCbtSimulation(
    @Args("input", { type: () => StartCbtSimulationInput })
    input: StartCbtSimulationInput,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CbtSessionDetailType> {
    return this.sessions.startSimulation(input, db, toAudit(admin, ctx, ip));
  }

  @Mutation(() => CbtSessionDetailType)
  @AppScoped()
  @RequirePermissions("cbt.sessions.manage")
  async submitCbtAnswers(
    @Args() args: SubmitCbtAnswersArgs,
    @AppDb() db: Db,
  ): Promise<CbtSessionDetailType> {
    return this.sessions.submitAnswers(args.sessionId, args.answers, db);
  }

  @Mutation(() => CbtSessionDetailType)
  @AppScoped()
  @RequirePermissions("cbt.sessions.manage")
  async finishCbtSession(
    @Args("id", { type: () => ID }) id: string,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CbtSessionDetailType> {
    return this.sessions.finish(id, db, toAudit(admin, ctx, ip));
  }

  @Query(() => CbtResultConnection)
  @AppScoped()
  @RequirePermissions("cbt.results.view")
  async cbtResults(
    @Args() args: CbtResultPageArgs,
    @AppDb() db: Db,
  ): Promise<CbtResultConnection> {
    const filter = args.filter;
    const { items, total } = await this.sessions.listResults(
      {
        filter: {
          packageId:
            filter?.packageId === undefined ? undefined : Number(filter.packageId),
          passed: filter?.passed,
        },
        page: args.page,
        perPage: args.perPage,
      },
      db,
    );
    const connection = new CbtResultConnection();
    connection.items = items;
    connection.total = total;
    return connection;
  }

  @Query(() => CbtPackageStatsType)
  @AppScoped()
  @RequirePermissions("cbt.results.view")
  async cbtPackageStats(
    @Args("packageId", { type: () => ID }) packageId: string,
    @AppDb() db: Db,
  ): Promise<CbtPackageStatsType> {
    return this.sessions.packageStats(packageId, db);
  }
}
