import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { ActivityLogType } from "../../activity-logs/types/activity-log.type";

@ObjectType({ description: "Kartu ringkas satu aplikasi di dasbor global." })
export class PlatformAppCardType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  status!: string;

  @Field(() => Int)
  userCount!: number;

  @Field(() => Int)
  activityCount7d!: number;
}

@ObjectType({ description: "Agregat status antrean kampanye notifikasi." })
export class NotificationQueueType {
  @Field(() => Int)
  scheduled!: number;

  @Field(() => Int)
  sending!: number;

  @Field(() => Int)
  failed!: number;
}

@ObjectType({ description: "Dasbor global platform (F07)." })
export class PlatformDashboardType {
  @Field(() => [PlatformAppCardType])
  apps!: PlatformAppCardType[];

  @Field(() => [ActivityLogType])
  recentActivity!: ActivityLogType[];

  @Field(() => NotificationQueueType)
  notificationQueue!: NotificationQueueType;
}

@ObjectType({ description: "Satu kartu statistik sumbangan modul domain." })
export class DashboardSectionType {
  @Field(() => String)
  key!: string;

  @Field(() => String)
  label!: string;

  @Field(() => Int)
  value!: number;

  @Field(() => String, { nullable: true })
  hint!: string | null;
}

@ObjectType({ description: "Identitas aplikasi konteks dasbor." })
export class AppDashboardAppType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  status!: string;
}

@ObjectType({ description: "Ringkasan status kampanye satu aplikasi." })
export class AppCampaignSummaryType {
  @Field(() => Int)
  draft!: number;

  @Field(() => Int)
  scheduled!: number;

  @Field(() => Int)
  sent!: number;

  @Field(() => Int)
  failed!: number;
}

@ObjectType({ description: "Dasbor satu aplikasi (F07)." })
export class AppDashboardType {
  @Field(() => AppDashboardAppType)
  app!: AppDashboardAppType;

  @Field(() => [DashboardSectionType])
  sections!: DashboardSectionType[];

  @Field(() => [ActivityLogType])
  recentActivity!: ActivityLogType[];

  @Field(() => AppCampaignSummaryType)
  campaigns!: AppCampaignSummaryType;
}
