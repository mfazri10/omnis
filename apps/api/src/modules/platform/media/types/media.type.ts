import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from "@nestjs/graphql";

@ObjectType({ description: "Metadata media (F09): satu berkas per App DB." })
export class MediaType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  fileName!: string;

  @Field(() => String)
  path!: string;

  @Field(() => String)
  url!: string;

  @Field(() => String)
  mimeType!: string;

  @Field(() => Int)
  sizeBytes!: number;

  @Field(() => String, { nullable: true })
  altText!: string | null;

  @Field(() => ID, { nullable: true })
  uploadedByAdminId!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType({ description: "Daftar media berhalaman (page/perPage + total)." })
export class MediaConnection {
  @Field(() => [MediaType])
  items!: MediaType[];

  @Field(() => Int)
  total!: number;
}
