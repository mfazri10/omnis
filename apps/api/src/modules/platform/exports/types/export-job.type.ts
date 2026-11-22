import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";

export enum ExportSource {
  APP_USERS = "APP_USERS",
  ACTIVITY_LOGS = "ACTIVITY_LOGS",
  CBT_RESULTS = "CBT_RESULTS",
}

export enum ExportJobStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  DONE = "DONE",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
}

registerEnumType(ExportSource, {
  name: "ExportSource",
  description: "Sumber data ekspor CSV (F11).",
});

registerEnumType(ExportJobStatus, {
  name: "ExportJobStatus",
  description:
    "Status job ekspor: QUEUED, RUNNING, DONE, FAILED, EXPIRED.",
});

@ObjectType({
  description: "Job ekspor CSV (F11): satu baris per permintaan unduh.",
})
export class ExportJobType {
  @Field(() => ID)
  id!: string;

  @Field(() => ExportSource)
  source!: ExportSource;

  @Field(() => ExportJobStatus)
  status!: ExportJobStatus;

  @Field(() => Int, { nullable: true })
  rowCount!: number | null;

  @Field(() => String, { nullable: true })
  fileName!: string | null;

  @Field(() => Int, { nullable: true })
  fileSizeBytes!: number | null;

  @Field(() => String, { nullable: true })
  errorMessage!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Path unduh ber-auth, hanya terisi saat status DONE.",
  })
  downloadPath!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expiresAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
