import {
  bigint,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "../../shared/entities/users.entity";
import { cbtPackages } from "./packages.entity";

export type CbtSessionStatus = "ongoing" | "completed";

/**
 * Sesi ujian (F12). Fase CMS: sesi dibuat lewat simulasi penilaian
 * (PRD §7.3); `appUserId` menunjuk peserta (user aplikasi) bila ada,
 * `participantName` selalu diisi sebagai snapshot nama. `createdBy`
 * = id admin control-plane (tanpa FK lintas database).
 */
export const cbtSessions = pgTable("cbt_sessions", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  packageId: bigint("package_id", { mode: "number" })
    .notNull()
    .references(() => cbtPackages.id),
  appUserId: bigint("app_user_id", { mode: "number" }).references(
    () => users.id,
  ),
  participantName: varchar("participant_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 16 })
    .$type<CbtSessionStatus>()
    .notNull()
    .default("ongoing"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdBy: bigint("created_by", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CbtSessionRow = typeof cbtSessions.$inferSelect;
