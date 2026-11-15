import {
  bigint,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Permission terdaftar (doc 06). Di-seed dari katalog modul (doc 04);
 * tidak dibuat manual — tanpa mutasi create.
 */
export const permissions = pgTable(
  "permissions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    key: varchar("key", { length: 255 }).notNull(),
    module: varchar("module", { length: 64 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    description: varchar("description", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("permissions_key_uk").on(t.key)],
);

export type PermissionRow = typeof permissions.$inferSelect;
