import {
  ArgsType,
  Field,
  GraphQLISODateTime,
  InputType,
  Int,
} from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
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

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export type CampaignTargetType = "all" | "segment";

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
];

const TARGET_TYPES: CampaignTargetType[] = ["all", "segment"];
const URL_PATTERN = /^https?:\/\/\S+$/;

@InputType()
export class CampaignFilterInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: CampaignStatus;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

/** Pagination + filter kampanye: page/perPage + total (pola F06/F08). */
@ArgsType()
export class CampaignPageArgs {
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
  @Field(() => CampaignFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignFilterInput)
  filter?: CampaignFilterInput;
}

@InputType()
export class CreateCampaignInput {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  body!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(URL_PATTERN)
  imageUrl?: string;

  /**
   * Rute tujuan di aplikasi (mis. `/promo/ramadan`), dipakai fase mobile.
   * Bukan URL penuh sehingga tanpa validasi pola URL.
   */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  linkTarget?: string;

  @Field(() => String, { nullable: true, defaultValue: "all" })
  @IsOptional()
  @IsIn(TARGET_TYPES)
  targetType?: CampaignTargetType;

  /**
   * JSON string kriteria segmen, mis. `{"last_active_days":30}`.
   * Dipakai string (bukan scalar JSON) karena repo belum punya scalar
   * JSON; service mem-parse sebelum simpan (pola metadata F08).
   */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  targetSegment?: string;

  /**
   * Jadwal kirim: di masa depan → status `scheduled`, kosong → `draft`.
   */
  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  scheduledAt?: Date;
}

@InputType()
export class UpdateCampaignInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  body?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(URL_PATTERN)
  imageUrl?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  linkTarget?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(TARGET_TYPES)
  targetType?: CampaignTargetType;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  targetSegment?: string | null;

  /** null menghapus jadwal (kembali `draft`); kosong = tak berubah. */
  @Field(() => GraphQLISODateTime, { nullable: true })
  @IsOptional()
  scheduledAt?: Date | null;
}
