import {
  registerEnumType,
} from "@nestjs/graphql";

/** Kategori soal CPNS baku (doc 10 bagian 3). */
export enum CbtCategoryGql {
  TWK = "TWK",
  TIU = "TIU",
  TKP = "TKP",
}

/** Opsi jawaban baku A..E. */
export enum CbtOptionGql {
  A = "A",
  B = "B",
  C = "C",
  D = "D",
  E = "E",
}

/** Status sesi: nilai internal sama dengan kolom database. */
export enum CbtSessionStatusGql {
  ONGOING = "ongoing",
  COMPLETED = "completed",
}

registerEnumType(CbtCategoryGql, {
  name: "CbtCategory",
  description: "Kategori soal CPNS: TWK, TIU, TKP.",
});

registerEnumType(CbtOptionGql, {
  name: "CbtOption",
  description: "Opsi jawaban A sampai E.",
});

registerEnumType(CbtSessionStatusGql, {
  name: "CbtSessionStatus",
  description: "Status sesi ujian CBT.",
});
