import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType({ description: "Penetapan role ke admin (F05)." })
export class RoleAssignmentType {
  @Field(() => ID)
  roleId!: string;

  @Field(() => String)
  roleName!: string;

  @Field(() => String, { description: "global | app" })
  scopeType!: string;

  @Field(() => ID, { nullable: true })
  appId!: string | null;

  @Field(() => String, { nullable: true })
  appSlug!: string | null;
}
