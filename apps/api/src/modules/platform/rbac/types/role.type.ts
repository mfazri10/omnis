import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType({ description: "Role RBAC (F05)." })
export class RoleType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String, { description: "global | app" })
  scopeType!: string;

  @Field(() => ID, { nullable: true })
  appId!: string | null;

  @Field(() => [String])
  permissionKeys!: string[];
}
