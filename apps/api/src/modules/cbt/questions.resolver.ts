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
  CbtQuestionPageArgs,
  CreateCbtQuestionInput,
  UpdateCbtQuestionInput,
} from "./dto/question.input";
import { CbtQuestionsService } from "./questions.service";
import { CbtQuestionConnection, CbtQuestionType } from "./types/question.type";

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
export class CbtQuestionsResolver {
  constructor(private readonly questions: CbtQuestionsService) {}

  @Query(() => CbtQuestionConnection)
  @AppScoped()
  @RequirePermissions("cbt.questions.view")
  async cbtQuestions(
    @Args() args: CbtQuestionPageArgs,
    @AppDb() db: Db,
  ): Promise<CbtQuestionConnection> {
    const filter = args.filter;
    const { items, total } = await this.questions.list(
      {
        filter: {
          category: filter?.category,
          search: filter?.search,
          isActive: filter?.isActive,
        },
        page: args.page,
        perPage: args.perPage,
      },
      db,
    );
    const connection = new CbtQuestionConnection();
    connection.items = items.map((item): CbtQuestionType => ({ ...item }));
    connection.total = total;
    return connection;
  }

  @Query(() => CbtQuestionType)
  @AppScoped()
  @RequirePermissions("cbt.questions.view")
  async cbtQuestion(
    @Args("id", { type: () => ID }) id: string,
    @AppDb() db: Db,
  ): Promise<CbtQuestionType> {
    return { ...(await this.questions.get(id, db)) };
  }

  @Mutation(() => CbtQuestionType)
  @AppScoped()
  @RequirePermissions("cbt.questions.manage")
  async createCbtQuestion(
    @Args("input", { type: () => CreateCbtQuestionInput })
    input: CreateCbtQuestionInput,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CbtQuestionType> {
    const created = await this.questions.create(input, db, toAudit(admin, ctx, ip));
    return { ...created };
  }

  @Mutation(() => CbtQuestionType)
  @AppScoped()
  @RequirePermissions("cbt.questions.manage")
  async updateCbtQuestion(
    @Args("id", { type: () => ID }) id: string,
    @Args("input", { type: () => UpdateCbtQuestionInput })
    input: UpdateCbtQuestionInput,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CbtQuestionType> {
    const updated = await this.questions.update(id, input, db, toAudit(admin, ctx, ip));
    return { ...updated };
  }

  @Mutation(() => CbtQuestionType)
  @AppScoped()
  @RequirePermissions("cbt.questions.manage")
  async setCbtQuestionActive(
    @Args("id", { type: () => ID }) id: string,
    @Args("active", { type: () => Boolean }) active: boolean,
    @AppDb() db: Db,
    @AppContext() ctx: AppContextData,
    @CurrentAdmin() admin: AdminProfile,
    @ClientIp() ip: string | null,
  ): Promise<CbtQuestionType> {
    const updated = await this.questions.setActive(id, active, db, toAudit(admin, ctx, ip));
    return { ...updated };
  }
}
