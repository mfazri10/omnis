import {
  ArgsType,
  Field,
  ID,
  InputType,
  Int,
} from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CbtOptionGql, CbtSessionStatusGql } from "../types/cbt-enums";

/**
 * Mulai simulasi penilaian dari CMS (PRD §7.3): peserta bisa user
 * aplikasi (`appUserId`) atau nama bebas (`participantName`); salah
 * satu wajib, dan bila keduanya ada nama user menjadi snapshot.
 */
@InputType()
export class StartCbtSimulationInput {
  @Field(() => ID)
  @IsString()
  packageId!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  appUserId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  participantName?: string;
}

/** Satu jawaban; selectedOption null berarti mengosongkan jawaban. */
@InputType()
export class CbtAnswerInput {
  @Field(() => ID)
  @IsString()
  questionId!: string;

  @Field(() => CbtOptionGql, { nullable: true })
  @IsOptional()
  @IsIn(["A", "B", "C", "D", "E"])
  selectedOption?: "A" | "B" | "C" | "D" | "E" | null;
}

@ArgsType()
export class SubmitCbtAnswersArgs {
  @Field(() => ID)
  @IsString()
  sessionId!: string;

  @Field(() => [CbtAnswerInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CbtAnswerInput)
  answers!: CbtAnswerInput[];
}

@InputType()
export class CbtSessionFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  packageId?: string;

  @Field(() => CbtSessionStatusGql, { nullable: true })
  @IsOptional()
  @IsIn(["ongoing", "completed"])
  status?: "ongoing" | "completed";

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

@ArgsType()
export class CbtSessionPageArgs {
  @Field(() => Int, { defaultValue: 1 })
  @Min(1)
  page = 1;

  @Field(() => Int, { defaultValue: 20 })
  @Min(1)
  @Max(100)
  perPage = 20;

  @Field(() => CbtSessionFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CbtSessionFilterInput)
  filter?: CbtSessionFilterInput;
}

@InputType()
export class CbtResultFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  packageId?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  passed?: boolean;
}

@ArgsType()
export class CbtResultPageArgs {
  @Field(() => Int, { defaultValue: 1 })
  @Min(1)
  page = 1;

  @Field(() => Int, { defaultValue: 20 })
  @Min(1)
  @Max(100)
  perPage = 20;

  @Field(() => CbtResultFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CbtResultFilterInput)
  filter?: CbtResultFilterInput;
}
