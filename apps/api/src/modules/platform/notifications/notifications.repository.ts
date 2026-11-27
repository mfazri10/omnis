import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, ilike, inArray, lt, lte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import type {
  CampaignRow,
  CampaignSegmentCriteria,
  CampaignStatusValue,
} from "../entities/notification-campaigns.entity";
import { notificationCampaigns } from "../entities/notification-campaigns.entity";
import type { CampaignTargetTypeValue } from "../entities/notification-campaigns.entity";

export interface CampaignFilters {
  appId: number;
  status?: CampaignStatusValue;
  search?: string;
}

export interface InsertCampaignRow {
  appId: number;
  createdBy: number;
  title: string;
  body: string;
  imageUrl: string | null;
  linkTarget: string | null;
  targetType: CampaignTargetTypeValue;
  targetSegment: CampaignSegmentCriteria | null;
  status: CampaignStatusValue;
  scheduledAt: Date | null;
}

export interface UpdateCampaignRow {
  title?: string;
  body?: string;
  imageUrl?: string | null;
  linkTarget?: string | null;
  targetType?: CampaignTargetTypeValue;
  targetSegment?: CampaignSegmentCriteria | null;
  status?: CampaignStatusValue;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  targetCount?: number;
  sentCount?: number;
  failedCount?: number;
  simulatedCount?: number;
  unknownCount?: number;
  updatedAt: Date;
}

function toConditions(filters: CampaignFilters): SQL[] {
  const conditions: SQL[] = [eq(notificationCampaigns.appId, filters.appId)];
  if (filters.status !== undefined) {
    conditions.push(eq(notificationCampaigns.status, filters.status));
  }
  const term = filters.search?.trim();
  if (term !== undefined && term !== "") {
    conditions.push(ilike(notificationCampaigns.title, `%${term}%`));
  }
  return conditions;
}

@Injectable()
export class CampaignsRepository {
  async list(
    db: Db,
    filters: CampaignFilters,
    pagination: { limit: number; offset: number },
  ): Promise<CampaignRow[]> {
    return db
      .select()
      .from(notificationCampaigns)
      .where(and(...toConditions(filters)))
      .orderBy(desc(notificationCampaigns.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
  }

  async count(db: Db, filters: CampaignFilters): Promise<number> {
    const rows = await db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(notificationCampaigns)
      .where(and(...toConditions(filters)));
    return rows[0]?.value ?? 0;
  }

  async findById(db: Db, id: number): Promise<CampaignRow | null> {
    const rows = await db
      .select()
      .from(notificationCampaigns)
      .where(eq(notificationCampaigns.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async insert(db: Db, row: InsertCampaignRow): Promise<CampaignRow> {
    const rows = await db
      .insert(notificationCampaigns)
      .values(row)
      .returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal membuat kampanye notifikasi.");
    }
    return created;
  }

  async update(
    db: Db,
    id: number,
    patch: UpdateCampaignRow,
  ): Promise<CampaignRow> {
    const rows = await db
      .update(notificationCampaigns)
      .set(patch)
      .where(eq(notificationCampaigns.id, id))
      .returning();
    const updated = rows[0];
    if (!updated) {
      throw new Error("Gagal mengubah kampanye notifikasi.");
    }
    return updated;
  }

  async updateSending(
    db: Db,
    id: number,
    patch: UpdateCampaignRow,
  ): Promise<CampaignRow | null> {
    const rows = await db
      .update(notificationCampaigns)
      .set(patch)
      .where(and(
        eq(notificationCampaigns.id, id),
        eq(notificationCampaigns.status, "sending"),
      ))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Klaim kampanye jatuh tempo untuk dieksekusi: tiap kandidat dikunci
   * lewat UPDATE bersyarat (`status` masih `scheduled`) sehingga dua
   * instance tak memproses kampanye yang sama — klaim yang kalah
   * mengembalikan 0 baris dan dilewati.
   */
  async claimDueCampaigns(
    db: Db,
    now: Date,
    limit: number,
  ): Promise<CampaignRow[]> {
    const due = await db
      .select({ id: notificationCampaigns.id })
      .from(notificationCampaigns)
      .where(
        and(
          eq(notificationCampaigns.status, "scheduled"),
          lte(notificationCampaigns.scheduledAt, now),
        ),
      )
      .orderBy(asc(notificationCampaigns.scheduledAt))
      .limit(limit);
    const claimed: CampaignRow[] = [];
    for (const candidate of due) {
      const rows = await db
        .update(notificationCampaigns)
        .set({ status: "sending", updatedAt: new Date() })
        .where(
          and(
            eq(notificationCampaigns.id, candidate.id),
            eq(notificationCampaigns.status, "scheduled"),
          ),
        )
        .returning();
      const row = rows[0];
      if (row) {
        claimed.push(row);
      }
    }
    return claimed;
  }

  async markStaleSendingUnknown(db: Db, cutoff: Date): Promise<CampaignRow[]> {
    const stale = await db
      .select()
      .from(notificationCampaigns)
      .where(and(eq(notificationCampaigns.status, "sending"), lt(notificationCampaigns.updatedAt, cutoff)))
      .limit(100);
    const updated: CampaignRow[] = [];
    for (const row of stale) {
      const unknownCount = Math.max(
        0,
        row.targetCount - row.sentCount - row.failedCount - row.simulatedCount,
      );
      const rows = await db
        .update(notificationCampaigns)
        .set({
          status: "unknown",
          unknownCount,
          updatedAt: new Date(),
        })
        .where(and(
          eq(notificationCampaigns.id, row.id),
          eq(notificationCampaigns.status, "sending"),
          eq(notificationCampaigns.updatedAt, row.updatedAt),
        ))
        .returning();
      if (rows[0]) updated.push(rows[0]);
    }
    return updated;
  }

  /**
   * Kunci satu kampanye ke `sending` sebelum dikirim manual; null bila
   * statusnya sudah berubah (kalah balapan dengan runner/aksi lain).
   */
  async claimForSend(
    db: Db,
    id: number,
    from: CampaignStatusValue[],
  ): Promise<CampaignRow | null> {
    const rows = await db
      .update(notificationCampaigns)
      .set({ status: "sending", updatedAt: new Date() })
      .where(
        and(
          eq(notificationCampaigns.id, id),
          inArray(notificationCampaigns.status, from),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }
}
