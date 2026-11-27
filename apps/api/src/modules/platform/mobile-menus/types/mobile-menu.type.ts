import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from "@nestjs/graphql";

@ObjectType()
export class MobileMenuType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  appId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String, { nullable: true })
  routeKey!: string | null;

  @Field(() => String, { nullable: true })
  iconKey!: string | null;

  @Field(() => ID, { nullable: true })
  parentId!: string | null;

  @Field(() => Int)
  orderNo!: number;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
