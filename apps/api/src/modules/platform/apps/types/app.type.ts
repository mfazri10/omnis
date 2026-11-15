import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType({ description: "Aplikasi terdaftar, ringkas untuk form RBAC (F05)." })
export class AppType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  status!: string;
}
