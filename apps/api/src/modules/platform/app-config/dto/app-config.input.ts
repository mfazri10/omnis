import { Field, InputType } from "@nestjs/graphql";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

@InputType()
export class UpdateAppConfigInput {
  @Field(() => Boolean)
  @IsBoolean()
  maintenanceMode!: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  maintenanceMessage?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/)
  minVersionAndroid?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/)
  minVersionIos?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  themePrimaryColor?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^https?:\/\/\S+$/)
  logoMediaUrl?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail()
  supportEmail?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/)
  supportWhatsapp?: string | null;
}
