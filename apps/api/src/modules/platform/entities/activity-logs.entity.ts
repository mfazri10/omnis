import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { admins } from "./admins.entity";
import { apps } from "./apps.entity";

/**
 * Log audit append-only (doc 06, F06): siapa, kapan, aplikasi apa,
 * apa yang diubah. Tanpa updated_at/deleted_at — tidak ada jalur
 * ubah/hapus. app_id NULL = aksi global; SET NULL bila aplikasi dihapus.
 */
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    adminId: bigint("admin_id", { mode: "number" })
      .notNull()
      .references(() => admins.id),
    appId: bigint("app_id", { mode: "number" }).references(() => apps.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 32 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }),
    entityId: varchar("entity_id", { length: 64 }),
    summary: text("summary").notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("activity_logs_created_at_idx").on(t.createdAt.desc()),
    index("activity_logs_app_created_idx").on(t.appId, t.createdAt.desc()),
    index("activity_logs_admin_created_idx").on(t.adminId, t.createdAt.desc()),
    index("activity_logs_entity_idx").on(t.entityType, t.entityId),
  ],
);

export type ActivityLogRow = typeof activityLogs.$inferSelect;
