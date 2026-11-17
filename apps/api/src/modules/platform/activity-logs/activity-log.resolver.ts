import { UseGuards } from "@nestjs/common";
import { Args, Query, Resolver } from "@nestjs/graphql";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { ActivityLogService } from "./activity-log.service";
import {
  ActivityLogPageArgs,
} from "./dto/activity-log.input";
import {
  ActivityLogConnection,
  ActivityLogType,
} from "./types/activity-log.type";

@Resolver()
@UseGuards(AuthGuard, PermissionGuard)
export class ActivityLogResolver {
  constructor(private readonly activityLog: ActivityLogService) {}

  @Query(() => ActivityLogConnection)
  @RequirePermissions("platform.audit.view")
  async activityLogs(
    @Args() args: ActivityLogPageArgs,
  ): Promise<ActivityLogConnection> {
    const filter = args.filter;
    const { items, total } = await this.activityLog.list({
      filter: {
        dateFrom: filter?.dateFrom,
        dateTo: filter?.dateTo,
        appId: filter?.appId,
        adminId: filter?.adminId,
        entityType: filter?.entityType,
        action: filter?.action,
        search: filter?.search,
      },
      page: args.page,
      perPage: args.perPage,
    });
    const connection = new ActivityLogConnection();
    connection.items = items.map(
      (item): ActivityLogType => ({ ...item }),
    );
    connection.total = total;
    return connection;
  }
}
