import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { admins } from "./admins.entity";
import { apps } from "./apps.entity";

/** Status kampanye (doc 06): draf → terjadwal → mengirim → terkirim/gagal. */
export type CampaignStatusValue =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

/** Audiens kampanye: semua perangkat atau segmen sederhana v1. */
export type CampaignTargetTypeValue = "all" | "segment";

/**
 * Kriteria segmen v1: `last_active_days` memfilter token yang
 * `last_seen_at`-nya masih segar. Kunci tak dikenal diabaikan
 * (kompatibel maju); kriteria kosong = semua token.
 */
export interface CampaignSegmentCriteria {
  last_active_days?: number;
}

/**
 * Kampanye notifikasi push (F10, control-plane): satu baris per kampanye
 * per aplikasi. Agregat hasil ditulis worker/runner saat eksekusi.
 * Dihapus mengikuti aplikasinya (CASCADE); admin pembuat tak boleh
 * dihapus selama kampanyenya ada.
 */
export const notificationCampaigns = pgTable(
  "notification_campaigns",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    appId: bigint("app_id", { mode: "number" })
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    createdBy: bigint("created_by", { mode: "number" })
      .notNull()
      .references(() => admins.id),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    imageUrl: varchar("image_url", { length: 512 }),
    linkTarget: varchar("link_target", { length: 512 }),
    targetType: varchar("target_type", { length: 16 })
      .notNull()
      .default("all"),
    targetSegment: jsonb("target_segment").$type<CampaignSegmentCriteria | null>(),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    targetCount: integer("target_count").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("notification_campaigns_app_created_idx").on(
      t.appId,
      t.createdAt.desc(),
    ),
    index("notification_campaigns_status_scheduled_idx").on(
      t.status,
      t.scheduledAt,
    ),
  ],
);

export type CampaignRow = typeof notificationCampaigns.$inferSelect;
