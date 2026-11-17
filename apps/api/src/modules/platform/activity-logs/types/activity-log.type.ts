import { Field, GraphQLISODateTime, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType({ description: "Baris log audit (F06, append-only)." })
export class ActivityLogType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  adminId!: string;

  @Field(() => String, { nullable: true })
  adminName!: string | null;

  @Field(() => ID, { nullable: true })
  appId!: string | null;

  @Field(() => String, { nullable: true })
  appName!: string | null;

  @Field(() => String, { nullable: true })
  appSlug!: string | null;

  @Field(() => String)
  action!: string;

  @Field(() => String, { nullable: true })
  entityType!: string | null;

  @Field(() => String, { nullable: true })
  entityId!: string | null;

  @Field(() => String)
  summary!: string;

  @Field(() => String, { nullable: true })
  ipAddress!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType({ description: "Daftar log audit berhalaman (page/perPage + total)." })
export class ActivityLogConnection {
  @Field(() => [ActivityLogType])
  items!: ActivityLogType[];

  @Field(() => Int)
  total!: number;
}
