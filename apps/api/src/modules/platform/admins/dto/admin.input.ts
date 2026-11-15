import { Field, InputType } from "@nestjs/graphql";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

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
