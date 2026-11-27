import { ArgsType, Field, InputType } from "@nestjs/graphql";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PaginationArgs } from "../../../../common/types/pagination";

@ArgsType()
export class ListAdminsArgs extends PaginationArgs {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string | null;
}

@InputType()
export class CreateAdminInput {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @Field(() => String)
  @IsEmail()
  email!: string;

  @Field(() => String)
  @IsString()
  @MinLength(8)
  password!: string;
}

@InputType()
export class UpdateAdminInput {
  @Field(() => String)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;
}
