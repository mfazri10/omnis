import {
  ArgsType,
  Field,
  InputType,
  Int,
} from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsEmail,
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

export type AppUserStatus = "active" | "inactive";

const APP_USER_STATUSES: AppUserStatus[] = ["active", "inactive"];
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const URL_PATTERN = /^https?:\/\/\S+$/;

@InputType()
export class AppUserFilterInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(APP_USER_STATUSES)
  status?: AppUserStatus;
}

/** Pagination + filter user aplikasi: page/perPage + total. */
@ArgsType()
export class AppUserPageArgs {
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
  @Field(() => AppUserFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppUserFilterInput)
  filter?: AppUserFilterInput;
}

@InputType()
export class CreateAppUserInput {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN)
  phone?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(URL_PATTERN)
  avatarUrl?: string;

  /**
   * JSON string, mis. `{"outlet":"kasir-1"}`. Dipakai string (bukan
   * scalar JSON) karena repo belum punya scalar JSON dan menambah
   * dependency baru dilarang; service mem-parse sebelum simpan.
   */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  metadata?: string;
}

@InputType()
export class UpdateAppUserInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN)
  phone?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(URL_PATTERN)
  avatarUrl?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  metadata?: string | null;
}
