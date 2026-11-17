import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
} from "@nestjs/graphql";

@ObjectType({
  description:
    "Remote config aplikasi (F04): baris app_configs + field efektif dari registry apps.",
})
export class AppConfigType {
  @Field(() => ID)
  appId!: string;

  @Field(() => Boolean)
  maintenanceMode!: boolean;

  @Field(() => String, { nullable: true })
  maintenanceMessage!: string | null;

  @Field(() => String)
  minVersionAndroid!: string;

  @Field(() => String)
  minVersionIos!: string;

  @Field(() => String)
  themePrimaryColor!: string;

  @Field(() => String, { nullable: true })
  logoMediaUrl!: string | null;

  @Field(() => String, { nullable: true })
  supportEmail!: string | null;

  @Field(() => String, { nullable: true })
  supportWhatsapp!: string | null;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  @Field(() => String, { description: "Nama tampil dari registry apps." })
  displayName!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String, {
    nullable: true,
    description: "Logo config bila ada, bila null memakai icon registry.",
  })
  iconMediaUrl!: string | null;

  @Field(() => String, { nullable: true })
  storeUrlAndroid!: string | null;

  @Field(() => String, { nullable: true })
  storeUrlIos!: string | null;
}
