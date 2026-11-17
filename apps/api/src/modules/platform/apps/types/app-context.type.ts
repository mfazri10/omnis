import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType({ description: "Konteks aplikasi tervalidasi (F02)." })
export class AppContextType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  status!: string;
}
