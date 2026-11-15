import { sql } from "drizzle-orm";
import {
  bigint,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { apps } from "./apps.entity";

/** Cakupan role (doc 04 §3). */
export const roleScope = pgEnum("role_scope", ["global", "app"]);

/**
 * Role = nama + cakupan + himpunan permission (doc 06).
 * Nama unik dalam konteks cakupannya (R12).
 */
export const roles = pgTable(
  "roles",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 512 }),
    scopeType: roleScope("scope_type").notNull(),
    appId: bigint("app_id", { mode: "number" }).references(() => apps.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // SQL mentah: drizzle-kit memparameterkan eq() menjadi $1 tanpa nilai.
    uniqueIndex("roles_name_global_uk")
      .on(t.name)
      .where(sql`"scope_type" = 'global'`),
    uniqueIndex("roles_name_app_uk")
      .on(t.name, t.appId)
      .where(sql`"scope_type" = 'app'`),
  ],
);

export type RoleRow = typeof roles.$inferSelect;
