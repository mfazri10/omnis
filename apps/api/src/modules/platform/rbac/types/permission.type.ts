import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType({ description: "Permission terdaftar (F05)." })
export class PermissionType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  key!: string;

  @Field(() => String)
  module!: string;

  @Field(() => String)
  label!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field({ description: "True = hanya untuk role cakupan global." })
  globalOnly!: boolean;
}
