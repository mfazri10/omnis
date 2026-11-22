import { Field, GraphQLISODateTime, ID, Int, ObjectType } from "@nestjs/graphql";
import { CbtQuestionType } from "./question.type";

@ObjectType({ description: "Passing grade per kategori (konfigurabel)." })
export class CbtPassingGradeType {
  @Field(() => Int) twk!: number;
  @Field(() => Int) tiu!: number;
  @Field(() => Int) tkp!: number;
}

@ObjectType({ description: "Paket ujian CBT (F12)." })
export class CbtPackageType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Int)
  durationMinutes!: number;

  @Field(() => CbtPassingGradeType)
  passingGrade!: CbtPassingGradeType;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Int, { description: "Jumlah soal dalam komposisi paket." })
  questionCount!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType()
export class CbtPackageConnection {
  @Field(() => [CbtPackageType])
  items!: CbtPackageType[];

  @Field(() => Int)
  total!: number;
}

@ObjectType({ description: "Paket beserta komposisi soalnya." })
export class CbtPackageDetailType extends CbtPackageType {
  @Field(() => [CbtQuestionType])
  questions!: CbtQuestionType[];
}
