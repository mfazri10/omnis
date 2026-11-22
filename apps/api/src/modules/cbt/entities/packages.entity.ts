import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/** Passing grade per kategori, konfigurabel per paket (doc 10). */
export interface CbtPassingGrade {
  twk: number;
  tiu: number;
  tkp: number;
}

/**
 * Paket ujian CBT (F12): komposisi soal eksplisit lewat
 * `cbt_package_questions`; peserta lulus bila skor tiap kategori
 * mencapai passing grade paket.
 */
export const cbtPackages = pgTable("cbt_packages", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull().default(100),
  passingGrade: jsonb("passing_grade").$type<CbtPassingGrade>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CbtPackageRow = typeof cbtPackages.$inferSelect;
