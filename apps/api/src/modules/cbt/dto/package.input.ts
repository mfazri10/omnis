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
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

/** Passing grade per kategori; lulus bila semua kategori tercapai. */
@InputType()
export class CbtPassingGradeInput {
  @Field(() => Int) @Min(0) twk!: number;
  @Field(() => Int) @Min(0) tiu!: number;
  @Field(() => Int) @Min(0) tkp!: number;
}

@InputType()
export class CbtPackageFilterInput {
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

@ArgsType()
export class CbtPackagePageArgs {
  @Field(() => Int, { defaultValue: 1 })
  @Min(1)
  page = 1;

  @Field(() => Int, { defaultValue: 20 })
  @Min(1)
  @Max(100)
  perPage = 20;

  @Field(() => CbtPackageFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CbtPackageFilterInput)
  filter?: CbtPackageFilterInput;
}

@InputType()
export class CreateCbtPackageInput {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Int, { defaultValue: 100 })
  @Min(1)
  @Max(600)
  durationMinutes = 100;

  @Field(() => CbtPassingGradeInput)
  @ValidateNested()
  @Type(() => CbtPassingGradeInput)
  passingGrade!: CbtPassingGradeInput;
}

@InputType()
export class UpdateCbtPackageInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Min(1)
  @Max(600)
  durationMinutes?: number;

  @Field(() => CbtPassingGradeInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CbtPassingGradeInput)
  passingGrade?: CbtPassingGradeInput;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Ganti komposisi soal paket; urutan array = urutan penyajian. */
@ArgsType()
export class SetCbtPackageQuestionsArgs {
  @Field(() => ID)
  @IsString()
  id!: string;

  @Field(() => [ID])
  @IsArray()
  @IsString({ each: true })
  questionIds!: string[];
}
