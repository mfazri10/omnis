import {
  bigint,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Token FCM perangkat (F10): cermin kolom tabel `device_tokens` template
 * App DB (migrasi app-template 20261116000001) yang dibaca worker
 * notifikasi. Berkas ini sengaja di luar folder `entities/` agar glob
 * drizzle-kit tidak membangkitkan migrasi control-plane dari tabel
 * template (pola F08/F09). Kolom `platform`/`app_version` tak dicerminkan
 * karena pengiriman Fase 1 tak memakainya.
 */
export const campaignDeviceTokens = pgTable("device_tokens", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  userId: bigint("user_id", { mode: "number" }),
  token: varchar("token", { length: 512 }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CampaignDeviceTokenRow =
  typeof campaignDeviceTokens.$inferSelect;
