import {
  bigint,
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/** Kategori soal CPNS baku (doc 10 bagian 3). */
export type CbtCategory = "TWK" | "TIU" | "TKP";

/** Opsi jawaban baku A..E. */
export type CbtOption = "A" | "B" | "C" | "D" | "E";

/** Bobot TKP per opsi, skala 1..5 (doc 10 bagian 3). */
export type TkpWeights = Record<CbtOption, number>;

/**
 * Bank soal CBT (F12): tinggal di App DB aplikasi, BUKAN control-plane.
 * TWK/TIU dinilai benar=5 salah=0 lewat `correctOption`; TKP dinilai
 * per opsi lewat `tkpWeights` (1..5). Kolom yang tidak dipakai kategori
 * lain dibiarkan null dan divalidasi di service.
 */
export const cbtQuestions = pgTable("cbt_questions", {
  id: bigint("id", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  category: varchar("category", { length: 8 }).$type<CbtCategory>().notNull(),
  stem: text("stem").notNull(),
  imageUrl: varchar("image_url", { length: 512 }),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  optionE: text("option_e").notNull(),
  correctOption: varchar("correct_option", { length: 1 }).$type<CbtOption>(),
  tkpWeights: jsonb("tkp_weights").$type<TkpWeights>(),
  explanation: text("explanation"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CbtQuestionRow = typeof cbtQuestions.$inferSelect;
