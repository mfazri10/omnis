import { Field, Float, GraphQLISODateTime, ID, Int, ObjectType } from "@nestjs/graphql";
import { CbtSessionStatusGql } from "./cbt-enums";
import { CbtPackageType } from "./package.type";
import { CbtQuestionType } from "./question.type";
import { CbtOptionGql } from "./cbt-enums";

@ObjectType({ description: "Sesi ujian CBT (F12); fase CMS = simulasi." })
export class CbtSessionType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  packageId!: string;

  @Field(() => String)
  packageTitle!: string;

  @Field(() => ID, { nullable: true })
  appUserId!: string | null;

  @Field(() => String)
  participantName!: string;

  @Field(() => CbtSessionStatusGql)
  status!: "ongoing" | "completed";

  @Field(() => GraphQLISODateTime)
  startedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  finishedAt!: Date | null;

  @Field(() => ID)
  createdBy!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType()
export class CbtSessionConnection {
  @Field(() => [CbtSessionType])
  items!: CbtSessionType[];

  @Field(() => Int)
  total!: number;
}

@ObjectType({ description: "Jawaban peserta untuk satu soal." })
export class CbtAnswerType {
  @Field(() => ID)
  questionId!: string;

  @Field(() => CbtOptionGql, { nullable: true })
  selectedOption!: "A" | "B" | "C" | "D" | "E" | null;
}

@ObjectType({ description: "Hasil penilaian otomatis satu sesi." })
export class CbtResultType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  sessionId!: string;

  @Field(() => String)
  participantName!: string;

  @Field(() => ID)
  packageId!: string;

  @Field(() => String)
  packageTitle!: string;

  @Field(() => Int) twkScore!: number;
  @Field(() => Int) tiuScore!: number;
  @Field(() => Int) tkpScore!: number;
  @Field(() => Int) totalScore!: number;

  @Field(() => Boolean)
  passed!: boolean;

  @Field(() => GraphQLISODateTime)
  computedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  finishedAt!: Date | null;
}

@ObjectType()
export class CbtResultConnection {
  @Field(() => [CbtResultType])
  items!: CbtResultType[];

  @Field(() => Int)
  total!: number;
}

@ObjectType({
  description: "Sesi lengkap: paket, soal, jawaban, dan hasil bila sudah selesai.",
})
export class CbtSessionDetailType {
  @Field(() => CbtSessionType)
  session!: CbtSessionType;

  @Field(() => CbtPackageType)
  package!: CbtPackageType;

  @Field(() => [CbtQuestionType])
  questions!: CbtQuestionType[];

  @Field(() => [CbtAnswerType])
  answers!: CbtAnswerType[];

  @Field(() => CbtResultType, { nullable: true })
  result!: CbtResultType | null;
}

@ObjectType({ description: "Analitik agregat satu paket (F12)." })
export class CbtPackageStatsType {
  @Field(() => ID)
  packageId!: string;

  @Field(() => Int)
  completed!: number;

  @Field(() => Int)
  passedCount!: number;

  @Field(() => Float, { description: "Persentase lulus 0..100; 0 bila belum ada sesi selesai." })
  passRate!: number;

  @Field(() => Float, { nullable: true }) avgTotal!: number | null;
  @Field(() => Float, { nullable: true }) avgTwk!: number | null;
  @Field(() => Float, { nullable: true }) avgTiu!: number | null;
  @Field(() => Float, { nullable: true }) avgTkp!: number | null;
  @Field(() => Int, { nullable: true }) maxTotal!: number | null;
  @Field(() => Int, { nullable: true }) minTotal!: number | null;
}
