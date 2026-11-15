import { Field, GraphQLISODateTime, ID, ObjectType } from "@nestjs/graphql";

@ObjectType({ description: "Aplikasi terdaftar (F03). Kredensial FCM TIDAK PERNAH terekspos." })
export class AppType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  dbName!: string;

  @Field(() => String, { nullable: true })
  iconMediaUrl!: string | null;

  @Field(() => String, { nullable: true })
  androidPackage!: string | null;

  @Field(() => String, { nullable: true })
  iosBundleId!: string | null;

  @Field(() => String, { nullable: true })
  storeUrlAndroid!: string | null;

  @Field(() => String, { nullable: true })
  storeUrlIos!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => String, { nullable: true })
  failureReason!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastProvisioningAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => Boolean)
  fcmConfigured!: boolean;
}
