import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { admins } from "../entities/admins.entity";
import { apps } from "../entities/apps.entity";
import { activityLogs } from "../entities/activity-logs.entity";
import type { ActivityLogRow } from "../entities/activity-logs.entity";

export interface ActivityLogFilters {
  dateFrom?: Date;
  dateTo?: Date;
  appId?: number;
  adminId?: number;
  entityType?: string;
  action?: string;
  search?: string;
}

export interface ActivityLogListItem {
  id: number;
  adminId: number;
  adminName: string | null;
  appId: number | null;
  appName: string | null;
  appSlug: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  ipAddress: string | null;
  createdAt: Date;
}

export interface InsertActivityLogRow {
  adminId: number;
  appId: number | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  ipAddress: string | null;
}

function toConditions(filters: ActivityLogFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.dateFrom !== undefined) {
    conditions.push(gte(activityLogs.createdAt, filters.dateFrom));
  }
  if (filters.dateTo !== undefined) {
    conditions.push(lte(activityLogs.createdAt, filters.dateTo));
  }
  if (filters.appId !== undefined) {
    conditions.push(eq(activityLogs.appId, filters.appId));
  }
  if (filters.adminId !== undefined) {
    conditions.push(eq(activityLogs.adminId, filters.adminId));
  }
  if (filters.entityType !== undefined) {
    conditions.push(eq(activityLogs.entityType, filters.entityType));
  }
  if (filters.action !== undefined) {
    conditions.push(eq(activityLogs.action, filters.action));
  }
  const term = filters.search?.trim();
  if (term !== undefined && term !== "") {
    conditions.push(ilike(activityLogs.summary, `%${term}%`));
  }
  return conditions;
}

@Injectable()
export class ActivityLogsRepository {
  async insert(db: Db, row: InsertActivityLogRow): Promise<ActivityLogRow> {
    const rows = await db.insert(activityLogs).values(row).returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal mencatat audit log.");
    }
    return created;
  }

  async list(
    db: Db,
    filters: ActivityLogFilters,
    pagination: { limit: number; offset: number },
  ): Promise<ActivityLogListItem[]> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({
        id: activityLogs.id,
        adminId: activityLogs.adminId,
        adminName: admins.name,
        appId: activityLogs.appId,
        appName: apps.name,
        appSlug: apps.slug,
        action: activityLogs.action,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        summary: activityLogs.summary,
        ipAddress: activityLogs.ipAddress,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .leftJoin(admins, eq(admins.id, activityLogs.adminId))
      .leftJoin(apps, eq(apps.id, activityLogs.appId))
      .where(where)
      .orderBy(desc(activityLogs.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
    return rows;
  }

  async count(db: Db, filters: ActivityLogFilters): Promise<number> {
    const conditions = toConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(activityLogs)
      .where(where);
    return rows[0]?.value ?? 0;
  }
}
