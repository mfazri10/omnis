import { Field, ID, ObjectType } from "@nestjs/graphql";
import { PaginatedType } from "../../../../common/types/pagination";

@ObjectType({ description: "Profil admin CMS (F05)." })
export class AdminType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field()
  isSuperAdmin!: boolean;

  @Field()
  isActive!: boolean;
}

@ObjectType({ description: "Daftar admin berhalaman." })
export class AdminConnection extends PaginatedType(AdminType) {}
