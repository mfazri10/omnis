import {
  bigint,
  boolean,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/** Profil admin CMS (doc 06). Identitas login di tabel better-auth `user`. */
export const admins = pgTable(
  "admins",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    authUserId: varchar("auth_user_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("admins_auth_user_id_uk").on(t.authUserId),
    uniqueIndex("admins_email_uk").on(t.email),
  ],
);

export type AdminRow = typeof admins.$inferSelect;
