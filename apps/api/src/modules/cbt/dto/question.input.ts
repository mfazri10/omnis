import {
  ArgsType,
  Field,
  ID,
  InputType,
  Int,
} from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CbtCategoryGql, CbtOptionGql } from "../types/cbt-enums";

const CBT_CATEGORIES = ["TWK", "TIU", "TKP"] as const;
const URL_PATTERN = /^https?:\/\/\S+$/;

/** Bobot TKP per opsi (1..5); hanya untuk kategori TKP. */
@InputType()
export class TkpWeightsInput {
  @Field(() => Int) @Min(1) @Max(5) A!: number;
  @Field(() => Int) @Min(1) @Max(5) B!: number;
  @Field(() => Int) @Min(1) @Max(5) C!: number;
  @Field(() => Int) @Min(1) @Max(5) D!: number;
  @Field(() => Int) @Min(1) @Max(5) E!: number;
}

@InputType()
export class CbtQuestionFilterInput {
  @Field(() => CbtCategoryGql, { nullable: true })
  @IsOptional()
  @IsIn(CBT_CATEGORIES)
  category?: "TWK" | "TIU" | "TKP";

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Pagination + filter soal: page/perPage + total (pola F08). */
@ArgsType()
export class CbtQuestionPageArgs {
  @Field(() => Int, { defaultValue: 1 })
  @Min(1)
  page = 1;

  @Field(() => Int, { defaultValue: 20 })
  @Min(1)
  @Max(100)
  perPage = 20;

  // Filter wajib properti ArgsType: ValidationPipe global memakai
  // forbidNonWhitelisted (jebakan F06).
  @Field(() => CbtQuestionFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CbtQuestionFilterInput)
  filter?: CbtQuestionFilterInput;
}

@InputType()
export class CreateCbtQuestionInput {
  @Field(() => CbtCategoryGql)
  @IsIn(CBT_CATEGORIES)
  category!: "TWK" | "TIU" | "TKP";

  @Field(() => String)
  @IsString()
  @MinLength(1)
  stem!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(URL_PATTERN, { message: "URL gambar harus http(s) yang valid." })
  imageUrl?: string;

  @Field(() => String) @IsString() @MinLength(1) optionA!: string;
  @Field(() => String) @IsString() @MinLength(1) optionB!: string;
  @Field(() => String) @IsString() @MinLength(1) optionC!: string;
  @Field(() => String) @IsString() @MinLength(1) optionD!: string;
  @Field(() => String) @IsString() @MinLength(1) optionE!: string;

  /** Kunci jawaban TWK/TIU; wajib untuk kedua kategori itu. */
  @Field(() => CbtOptionGql, { nullable: true })
  @IsOptional()
  @IsIn(["A", "B", "C", "D", "E"])
  correctOption?: "A" | "B" | "C" | "D" | "E";

  /** Bobot TKP; wajib untuk kategori TKP. */
  @Field(() => TkpWeightsInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TkpWeightsInput)
  tkpWeights?: TkpWeightsInput;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  explanation?: string;
}

@InputType()
export class UpdateCbtQuestionInput {
  @Field(() => CbtCategoryGql, { nullable: true })
  @IsOptional()
  @IsIn(CBT_CATEGORIES)
  category?: "TWK" | "TIU" | "TKP";

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  stem?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(URL_PATTERN, { message: "URL gambar harus http(s) yang valid." })
  imageUrl?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  optionA?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  optionB?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  optionC?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  optionD?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  optionE?: string;

  @Field(() => CbtOptionGql, { nullable: true })
  @IsOptional()
  @IsIn(["A", "B", "C", "D", "E"])
  correctOption?: "A" | "B" | "C" | "D" | "E" | null;

  @Field(() => TkpWeightsInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TkpWeightsInput)
  tkpWeights?: TkpWeightsInput | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  explanation?: string | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ArgsType()
export class CbtQuestionIdArgs {
  @Field(() => ID)
  @IsString()
  id!: string;
}
