import {
  bigint,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { CbtOption } from "./questions.entity";
import { cbtQuestions } from "./questions.entity";
import { cbtSessions } from "./sessions.entity";

/** Jawaban peserta per soal; null = belum dijawab (skor 0). */
export const cbtAnswers = pgTable(
  "cbt_answers",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    sessionId: bigint("session_id", { mode: "number" })
      .notNull()
      .references(() => cbtSessions.id, { onDelete: "cascade" }),
    questionId: bigint("question_id", { mode: "number" })
      .notNull()
      .references(() => cbtQuestions.id),
    selectedOption: varchar("selected_option", { length: 1 }).$type<CbtOption>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("cbt_answers_session_question_uk").on(t.sessionId, t.questionId)],
);

export type CbtAnswerRow = typeof cbtAnswers.$inferSelect;
