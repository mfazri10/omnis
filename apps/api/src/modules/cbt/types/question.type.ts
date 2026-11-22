import { Field, GraphQLISODateTime, ID, Int, ObjectType } from "@nestjs/graphql";
import { CbtCategoryGql, CbtOptionGql } from "./cbt-enums";

@ObjectType({ description: "Bobot TKP per opsi (1..5)." })
export class TkpWeightsType {
  @Field(() => Int) A!: number;
  @Field(() => Int) B!: number;
  @Field(() => Int) C!: number;
  @Field(() => Int) D!: number;
  @Field(() => Int) E!: number;
}

@ObjectType({ description: "Soal bank soal CBT (F12)." })
export class CbtQuestionType {
  @Field(() => ID)
  id!: string;

  @Field(() => CbtCategoryGql)
  category!: "TWK" | "TIU" | "TKP";

  @Field(() => String)
  stem!: string;

  @Field(() => String, { nullable: true })
  imageUrl!: string | null;

  @Field(() => String) optionA!: string;
  @Field(() => String) optionB!: string;
  @Field(() => String) optionC!: string;
  @Field(() => String) optionD!: string;
  @Field(() => String) optionE!: string;

  @Field(() => CbtOptionGql, { nullable: true })
  correctOption!: "A" | "B" | "C" | "D" | "E" | null;

  @Field(() => TkpWeightsType, { nullable: true })
  tkpWeights!: TkpWeightsType | null;

  @Field(() => String, { nullable: true })
  explanation!: string | null;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType()
export class CbtQuestionConnection {
  @Field(() => [CbtQuestionType])
  items!: CbtQuestionType[];

  @Field(() => Int)
  total!: number;
}
