import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { admins } from "./admins.entity";

/** Sumber ekspor yang terdaftar (registry di modul exports). */
export type ExportSourceKey = "app_users" | "activity_logs" | "cbt_results";

/** Status job: queued → running → done/failed; done bisa kedaluwarsa. */
export type ExportJobStatusValue =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "expired";

/**
 * Filter tervalidasi dalam bentuk JSON plain (tanggal sebagai ISO string).
 * Dikembalikan ke bentuk filter repository saat job dieksekusi.
 */
export interface ExportJobFilterJson {
  [key: string]: unknown;
}

/**
 * Job ekspor CSV (F11, control-plane): satu baris per permintaan unduh.
 * File hasil hidup di root storage terpisah dan dihapus saat kedaluwarsa.
 */
export const exportJobs = pgTable(
  "export_jobs",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    requestedBy: bigint("requested_by", { mode: "number" })
      .notNull()
      .references(() => admins.id),
    source: varchar("source", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    appSlug: varchar("app_slug", { length: 64 }),
    filter: jsonb("filter").$type<ExportJobFilterJson>().notNull(),
    rowCount: integer("row_count"),
    fileName: varchar("file_name", { length: 255 }),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    errorMessage: varchar("error_message", { length: 512 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("export_jobs_requested_by_status_idx").on(t.requestedBy, t.status),
    index("export_jobs_status_expires_idx").on(t.status, t.expiresAt),
    index("export_jobs_status_updated_idx").on(t.status, t.updatedAt),
  ],
);

export type ExportJobRow = typeof exportJobs.$inferSelect;
