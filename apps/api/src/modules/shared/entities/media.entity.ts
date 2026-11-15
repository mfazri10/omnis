import {
  bigint,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Metadata media App DB (doc 06). `uploadedByAdminId` logis
 * (ID admin control-plane, BUKAN FK lintas database).
 */
export const media = pgTable("media", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  uploadedByAdminId: bigint("uploaded_by_admin_id", { mode: "number" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  path: varchar("path", { length: 512 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  mimeType: varchar("mime_type", { length: 127 }).notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  altText: varchar("alt_text", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type MediaRow = typeof media.$inferSelect;
