import { Field, ID, InputType, Int } from "@nestjs/graphql";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import type {
  CreateMobileMenuInput as CreateMobileMenuInputContract,
  UpdateMobileMenuInput as UpdateMobileMenuInputContract,
} from "../mobile-menus.service";

@InputType()
export class CreateMobileMenuInput implements CreateMobileMenuInputContract {
  @Field(() => String)
  @IsString()
  @MaxLength(255)
  name!: string;

  @Field(() => String)
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z][a-z0-9._-]{0,254}$/)
  routeKey?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z][a-z0-9._-]{0,254}$/)
  iconKey?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string | null;

  @Field(() => Int, { defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNo?: number;

  @Field(() => Boolean, { defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@InputType()
export class UpdateMobileMenuInput implements UpdateMobileMenuInputContract {
  @Field(() => ID)
  @IsString()
  @Matches(/^[1-9]\d*$/)
  id!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z][a-z0-9._-]{0,254}$/)
  routeKey?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z][a-z0-9._-]{0,254}$/)
  iconKey?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d*$/)
  parentId?: string | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNo?: number;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
