import { ArgsType, Field, InputType, Int } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

@InputType()
export class MediaFilterInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

/** Pagination + filter media: page/perPage + total (pola F06/F08). */
@ArgsType()
export class MediaPageArgs {
  @Field(() => Int, { defaultValue: 1 })
  @Min(1)
  page = 1;

  @Field(() => Int, { defaultValue: 20 })
  @Min(1)
  @Max(100)
  perPage = 20;

  /**
   * Filter adalah properti args, bukan argumen terpisah di resolver:
   * ValidationPipe global memakai forbidNonWhitelisted (pola F06).
   */
  @Field(() => MediaFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => MediaFilterInput)
  filter?: MediaFilterInput;
}
