import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from "@nestjs/graphql";

@ObjectType({
  description: "Kampanye notifikasi push (F10): satu baris per aplikasi.",
})
export class CampaignType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  appId!: string;

  @Field(() => ID)
  createdBy!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  body!: string;

  @Field(() => String, { nullable: true })
  imageUrl!: string | null;

  @Field(() => String, { nullable: true })
  linkTarget!: string | null;

  @Field(() => String, {
    description: "Audiens: all atau segment.",
  })
  targetType!: string;

  @Field(() => String, {
    nullable: true,
    description: "Kriteria segmen sebagai JSON string.",
  })
  targetSegment!: string | null;

  @Field(() => String, {
    description:
      "Status: draft, scheduled, sending, sent, simulated, unknown, failed, cancelled.",
  })
  status!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  scheduledAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  sentAt!: Date | null;

  @Field(() => Int)
  targetCount!: number;

  @Field(() => Int)
  sentCount!: number;

  @Field(() => Int)
  failedCount!: number;

  @Field(() => Int)
  simulatedCount!: number;

  @Field(() => Int)
  unknownCount!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType({
  description: "Daftar kampanye berhalaman (page/perPage + total).",
})
export class CampaignConnection {
  @Field(() => [CampaignType])
  items!: CampaignType[];

  @Field(() => Int)
  total!: number;
}
