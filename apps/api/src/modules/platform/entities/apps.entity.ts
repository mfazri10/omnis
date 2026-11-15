import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/** Status aplikasi (doc 06). Penegakan suspend milik F02/F03. */
export const appStatus = pgEnum("app_status", [
  "active",
  "suspended",
  "archived",
]);

/**
 * Registry aplikasi (doc 06, R1).
 * F05 membuat tabel + repo baca; CRUD/provisioning/FCM/UI milik F03.
 */
export const apps = pgTable(
  "apps",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    iconMediaUrl: varchar("icon_media_url", { length: 512 }),
    status: appStatus("status").notNull().default("active"),
    dbName: varchar("db_name", { length: 255 }).notNull(),
    androidPackage: varchar("android_package", { length: 255 }),
    iosBundleId: varchar("ios_bundle_id", { length: 255 }),
    storeUrlAndroid: varchar("store_url_android", { length: 512 }),
    storeUrlIos: varchar("store_url_ios", { length: 512 }),
    fcmCredential: text("fcm_credential"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("apps_slug_uk").on(t.slug)],
);

export type AppRow = typeof apps.$inferSelect;
