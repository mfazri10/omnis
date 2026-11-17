import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from "@nestjs/graphql";

@ObjectType({ description: "User aplikasi (F08): profil per App DB." })
export class AppUserType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  email!: string | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => String, {
    nullable: true,
    description: "Atribut khusus aplikasi sebagai JSON string.",
  })
  metadata!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastLoginAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType({ description: "Daftar user aplikasi berhalaman (page/perPage + total)." })
export class AppUserConnection {
  @Field(() => [AppUserType])
  items!: AppUserType[];

  @Field(() => Int)
  total!: number;
}
