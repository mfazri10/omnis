import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { RoleScope } from "../roles.repository";

@InputType()
export class CreateRoleInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @Field({ description: "global | app" })
  @IsIn(["global", "app"])
  scopeType!: RoleScope;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  appId?: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

@InputType()
export class UpdateRoleInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];
}
