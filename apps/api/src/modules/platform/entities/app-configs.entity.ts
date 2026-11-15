import {
  bigint,
  boolean,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { apps } from "./apps.entity";

/**
 * Konfigurasi per aplikasi, satu baris per aplikasi (doc 06).
 * Dibuat saat provisioning (F03); dikelola lewat remote config (F04).
 */
export const appConfigs = pgTable("app_configs", {
  appId: bigint("app_id", { mode: "number" })
    .primaryKey()
    .references(() => apps.id),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  maintenanceMessage: text("maintenance_message"),
  minVersionAndroid: varchar("min_version_android", { length: 32 }).notNull(),
  minVersionIos: varchar("min_version_ios", { length: 32 }).notNull(),
  themePrimaryColor: varchar("theme_primary_color", {
    length: 16,
  }).notNull(),
  logoMediaUrl: varchar("logo_media_url", { length: 512 }),
  supportEmail: varchar("support_email", { length: 255 }),
  supportWhatsapp: varchar("support_whatsapp", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AppConfigRow = typeof appConfigs.$inferSelect;
