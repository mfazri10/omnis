import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType({ description: "Aplikasi terdaftar, ringkas untuk form RBAC (F05)." })
export class AppType {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;

  @Field()
  status!: string;
}
