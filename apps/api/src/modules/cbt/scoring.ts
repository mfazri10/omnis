import type { CbtPassingGrade } from "./entities/packages.entity";
import type {
  CbtCategory,
  CbtOption,
  CbtQuestionRow,
  TkpWeights,
} from "./entities/questions.entity";

/** Skor benar untuk soal TWK/TIU (aturan baku CPNS, doc 10). */
export const TWK_TIU_CORRECT_SCORE = 5;

export interface CbtAnswerInput {
  questionId: number;
  selectedOption: CbtOption | null;
}

export interface CbtScoreDetail {
  twkScore: number;
  tiuScore: number;
  tkpScore: number;
  totalScore: number;
  passed: boolean;
}

/**
 * Nilai satu soal: TWK/TIU benar=5 salah/kosong=0; TKP = bobot opsi
 * terpilih (1..5), kosong=0. Fungsi murni agar teruji tanpa database.
 */
export function scoreQuestion(
  question: Pick<CbtQuestionRow, "category" | "correctOption" | "tkpWeights">,
  selected: CbtOption | null,
): number {
  if (selected === null) {
    return 0;
  }
  if (question.category === "TKP") {
    const weights = question.tkpWeights;
    if (!weights) {
      return 0;
    }
    const weight = weights[selected];
    return typeof weight === "number" && weight >= 1 && weight <= 5
      ? weight
      : 0;
  }
  return question.correctOption === selected ? TWK_TIU_CORRECT_SCORE : 0;
}

/**
 * Penilaian otomatis satu sesi: jumlahkan skor per kategori lalu
 * bandingkan dengan passing grade paket. Lulus bila SEMUA kategori
 * mencapai ambang (aturan CPNS); soal tanpa jawaban dihitung 0.
 */
export function scoreSession(
  questions: CbtQuestionRow[],
  answers: CbtAnswerInput[],
  passingGrade: CbtPassingGrade,
): CbtScoreDetail {
  const selectedByQuestion = new Map<number, CbtOption | null>();
  for (const answer of answers) {
    selectedByQuestion.set(answer.questionId, answer.selectedOption);
  }
  const totals: Record<CbtCategory, number> = { TWK: 0, TIU: 0, TKP: 0 };
  for (const question of questions) {
    const selected = selectedByQuestion.get(question.id) ?? null;
    totals[question.category] += scoreQuestion(question, selected);
  }
  const totalScore = totals.TWK + totals.TIU + totals.TKP;
  const passed =
    totals.TWK >= passingGrade.twk &&
    totals.TIU >= passingGrade.tiu &&
    totals.TKP >= passingGrade.tkp;
  return {
    twkScore: totals.TWK,
    tiuScore: totals.TIU,
    tkpScore: totals.TKP,
    totalScore,
    passed,
  };
}

/** Validasi bobot TKP: kelima opsi terisi, masing-masing 1..5. */
export function isValidTkpWeights(value: unknown): value is TkpWeights {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (["A", "B", "C", "D", "E"] as const).every((option) => {
    const weight = record[option];
    return (
      typeof weight === "number" &&
      Number.isInteger(weight) &&
      weight >= 1 &&
      weight <= 5
    );
  });
}
