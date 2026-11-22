import {
  bigint,
  boolean,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { cbtSessions } from "./sessions.entity";

/**
 * Hasil penilaian otomatis (F12): satu baris per sesi selesai.
 * TWK/TIU: benar=5, salah/kosong=0. TKP: bobot opsi terpilih (1..5),
 * kosong=0. Lulus bila SEMUA kategori mencapai passing grade paket.
 */
export const cbtResults = pgTable(
  "cbt_results",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    sessionId: bigint("session_id", { mode: "number" })
      .notNull()
      .references(() => cbtSessions.id, { onDelete: "cascade" }),
    twkScore: integer("twk_score").notNull().default(0),
    tiuScore: integer("tiu_score").notNull().default(0),
    tkpScore: integer("tkp_score").notNull().default(0),
    totalScore: integer("total_score").notNull().default(0),
    passed: boolean("passed").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("cbt_results_session_uk").on(t.sessionId)],
);

export type CbtResultRow = typeof cbtResults.$inferSelect;
