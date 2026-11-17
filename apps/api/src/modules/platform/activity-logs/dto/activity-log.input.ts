import {
  ArgsType,
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
} from "@nestjs/graphql";
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
export class ActivityLogFilterInput {
  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  dateFrom?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  dateTo?: Date;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  appId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  adminId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  action?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

/** Pagination + filter audit log: page/perPage + total (bukan skip/take). */
@ArgsType()
export class ActivityLogPageArgs {
  @Field(() => Int, { defaultValue: 1 })
  @Min(1)
  page = 1;

  @Field(() => Int, { defaultValue: 20 })
  @Min(1)
  @Max(100)
  perPage = 20;

  /**
   * Filter harus menjadi properti args, bukan argumen terpisah di resolver:
   * ValidationPipe global memakai forbidNonWhitelisted, sehingga argumen
   * kedua yang tidak terdeklarasi di kelas ArgsType ditolak 400 saat dipakai.
   */
  @Field(() => ActivityLogFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ActivityLogFilterInput)
  filter?: ActivityLogFilterInput;
}
