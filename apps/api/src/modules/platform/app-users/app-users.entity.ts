import {
  bigint,
  boolean,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * User aplikasi (F08): cermin kolom tabel `users` template App DB
 * (migrasi app-template 20261116000001). Berkas ini sengaja di luar
 * folder `entities/` agar glob drizzle-kit tidak membangkitkan migrasi
 * control-plane dari tabel template.
 */
export const appUsers = pgTable(
  "users",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    avatarUrl: varchar("avatar_url", { length: 512 }),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
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
    uniqueIndex("users_email_uk").on(t.email),
    uniqueIndex("users_phone_uk").on(t.phone),
  ],
);

export type AppUserRow = typeof appUsers.$inferSelect;
