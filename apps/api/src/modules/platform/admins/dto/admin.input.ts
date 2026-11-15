import { Field, InputType } from "@nestjs/graphql";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

@InputType()
export class CreateAdminInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @IsString()
  @MinLength(8)
  password!: string;
}

@InputType()
export class UpdateAdminInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;
}
