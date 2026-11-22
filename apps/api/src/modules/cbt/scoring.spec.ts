import type { CbtQuestionRow } from "./entities/questions.entity";
import {
  TWK_TIU_CORRECT_SCORE,
  isValidTkpWeights,
  scoreQuestion,
  scoreSession,
} from "./scoring";

function question(
  over: Partial<CbtQuestionRow> = {},
): CbtQuestionRow {
  return {
    id: 1,
    category: "TWK",
    stem: "Soal",
    imageUrl: null,
    optionA: "a",
    optionB: "b",
    optionC: "c",
    optionD: "d",
    optionE: "e",
    correctOption: "A",
    tkpWeights: null,
    explanation: null,
    isActive: true,
    createdAt: new Date("2026-11-21T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
    ...over,
  };
}

const WEIGHTS = { A: 1, B: 2, C: 3, D: 4, E: 5 };

describe("scoreQuestion", () => {
  it("TWK/TIU: benar = 5, salah = 0, kosong = 0", () => {
    const twk = question({ category: "TWK", correctOption: "C" });
    expect(scoreQuestion(twk, "C")).toBe(TWK_TIU_CORRECT_SCORE);
    expect(scoreQuestion(twk, "A")).toBe(0);
    expect(scoreQuestion(twk, null)).toBe(0);
    const tiu = question({ category: "TIU", correctOption: "E" });
    expect(scoreQuestion(tiu, "E")).toBe(5);
    expect(scoreQuestion(tiu, "B")).toBe(0);
  });

  it("TKP: bobot opsi terpilih 1..5, kosong = 0", () => {
    const tkp = question({ category: "TKP", correctOption: null, tkpWeights: WEIGHTS });
    expect(scoreQuestion(tkp, "A")).toBe(1);
    expect(scoreQuestion(tkp, "E")).toBe(5);
    expect(scoreQuestion(tkp, null)).toBe(0);
  });

  it("TKP tanpa bobot atau bobot di luar 1..5 dinilai 0", () => {
    const tanpa = question({ category: "TKP", correctOption: null, tkpWeights: null });
    expect(scoreQuestion(tanpa, "A")).toBe(0);
    const rusak = question({
      category: "TKP",
      correctOption: null,
      tkpWeights: { ...WEIGHTS, A: 9 },
    });
    expect(scoreQuestion(rusak, "A")).toBe(0);
    expect(scoreQuestion(rusak, "B")).toBe(2);
  });
});

describe("scoreSession", () => {
  const questions = [
    question({ id: 1, category: "TWK", correctOption: "A" }),
    question({ id: 2, category: "TWK", correctOption: "B" }),
    question({ id: 3, category: "TIU", correctOption: "C" }),
    question({ id: 4, category: "TKP", correctOption: null, tkpWeights: WEIGHTS }),
    question({ id: 5, category: "TKP", correctOption: null, tkpWeights: WEIGHTS }),
  ];

  it("menjumlahkan skor per kategori dan total", () => {
    const detail = scoreSession(
      questions,
      [
        { questionId: 1, selectedOption: "A" },
        { questionId: 2, selectedOption: "A" },
        { questionId: 3, selectedOption: "C" },
        { questionId: 4, selectedOption: "E" },
        { questionId: 5, selectedOption: "B" },
      ],
      { twk: 5, tiu: 5, tkp: 7 },
    );
    expect(detail).toEqual({
      twkScore: 5,
      tiuScore: 5,
      tkpScore: 7,
      totalScore: 17,
      passed: true,
    });
  });

  it("soal tanpa jawaban dihitung 0", () => {
    const detail = scoreSession(questions, [], { twk: 0, tiu: 0, tkp: 0 });
    expect(detail.totalScore).toBe(0);
    expect(detail.passed).toBe(true);
  });

  it("lulus bila skor tepat sama dengan passing grade (batas)", () => {
    const detail = scoreSession(
      questions,
      [
        { questionId: 1, selectedOption: "A" },
        { questionId: 3, selectedOption: "C" },
        { questionId: 4, selectedOption: "C" },
      ],
      { twk: 5, tiu: 5, tkp: 3 },
    );
    expect(detail.passed).toBe(true);
  });

  it("tidak lulus bila satu kategori saja di bawah ambang", () => {
    const detail = scoreSession(
      questions,
      [
        { questionId: 1, selectedOption: "A" },
        { questionId: 2, selectedOption: "B" },
        { questionId: 3, selectedOption: "C" },
        { questionId: 4, selectedOption: "E" },
        { questionId: 5, selectedOption: "E" },
      ],
      { twk: 10, tiu: 10, tkp: 10 },
    );
    expect(detail.twkScore).toBe(10);
    expect(detail.tiuScore).toBe(5);
    expect(detail.tkpScore).toBe(10);
    expect(detail.totalScore).toBe(25);
    expect(detail.passed).toBe(false);
  });
});

describe("isValidTkpWeights", () => {
  it("menerima kelima opsi 1..5", () => {
    expect(isValidTkpWeights(WEIGHTS)).toBe(true);
  });

  it("menolak nilai kurang, lebih, pecahan, opsi hilang, dan non-object", () => {
    expect(isValidTkpWeights({ ...WEIGHTS, A: 0 })).toBe(false);
    expect(isValidTkpWeights({ ...WEIGHTS, E: 6 })).toBe(false);
    expect(isValidTkpWeights({ ...WEIGHTS, C: 2.5 })).toBe(false);
    expect(isValidTkpWeights({ A: 1, B: 2, C: 3, D: 4 })).toBe(false);
    expect(isValidTkpWeights(null)).toBe(false);
    expect(isValidTkpWeights("12345")).toBe(false);
  });
});
