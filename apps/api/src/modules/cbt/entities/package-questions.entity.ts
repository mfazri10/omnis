import {
  bigint,
  integer,
  pgTable,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { cbtPackages } from "./packages.entity";
import { cbtQuestions } from "./questions.entity";

/** Komposisi paket: soal terpilih beserta urutannya. */
export const cbtPackageQuestions = pgTable(
  "cbt_package_questions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    packageId: bigint("package_id", { mode: "number" })
      .notNull()
      .references(() => cbtPackages.id, { onDelete: "cascade" }),
    questionId: bigint("question_id", { mode: "number" })
      .notNull()
      .references(() => cbtQuestions.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("cbt_package_questions_uk").on(t.packageId, t.questionId),
  ],
);

export type CbtPackageQuestionRow = typeof cbtPackageQuestions.$inferSelect;
