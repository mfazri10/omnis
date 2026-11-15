import {
  bigint,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.entity";

export const devicePlatform = pgEnum("device_platform", ["android", "ios"]);

/** Token FCM perangkat (doc 06). Diisi fase mobile; dibaca worker notifikasi. */
export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" }).references(() => users.id),
    token: varchar("token", { length: 512 }).notNull(),
    platform: devicePlatform("platform").notNull(),
    appVersion: varchar("app_version", { length: 32 }),
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
  },
  (t) => [uniqueIndex("device_tokens_token_uk").on(t.token)],
);

export type DeviceTokenRow = typeof deviceTokens.$inferSelect;
