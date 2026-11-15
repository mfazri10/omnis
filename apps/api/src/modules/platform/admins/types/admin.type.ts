import { Field, ID, ObjectType } from "@nestjs/graphql";
import { PaginatedType } from "../../../../common/types/pagination";

@ObjectType({ description: "Profil admin CMS (F05)." })
export class AdminType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => Boolean)
  isSuperAdmin!: boolean;

  @Field(() => Boolean)
  isActive!: boolean;
}

@ObjectType({ description: "Daftar admin berhalaman." })
export class AdminConnection extends PaginatedType(AdminType) {}
