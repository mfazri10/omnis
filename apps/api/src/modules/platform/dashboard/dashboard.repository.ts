import { Injectable } from "@nestjs/common";
import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { activityLogs } from "../entities/activity-logs.entity";
import { notificationCampaigns } from "../entities/notification-campaigns.entity";

/**
 * Agregat control-plane untuk dasbor. Repository stateless: tiap method
 * menerima `db` sebagai argumen pertama (pola backend §2).
 */
@Injectable()
export class DashboardRepository {
  /**
   * Hitung kampanye per status; `appId` kosong = semua aplikasi.
   * Status tak dikenal tetap dikembalikan apa adanya.
   */
  async countCampaignsByStatus(
    db: Db,
    appId?: number,
  ): Promise<Record<string, number>> {
    const rows = await db
      .select({
        status: notificationCampaigns.status,
        value: sql<number>`count(*)`.mapWith(Number),
      })
      .from(notificationCampaigns)
      .where(
        appId === undefined
          ? undefined
          : eq(notificationCampaigns.appId, appId),
      )
      .groupBy(notificationCampaigns.status);
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status ?? ""] = row.value;
    }
    return result;
  }

  /** Hitung aktivitas satu aplikasi sejak `since` (kartu 7 hari). */
  async countActivitiesSince(
    db: Db,
    appId: number,
    since: Date,
  ): Promise<number> {
    const rows = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(activityLogs)
      .where(
        and(eq(activityLogs.appId, appId), gte(activityLogs.createdAt, since)),
      );
    return rows[0]?.value ?? 0;
  }
}
