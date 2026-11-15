import { sql } from "drizzle-orm";
import type { MigrationContext } from "../../src/database/migration/migration-runner";

// SQL hasil `drizzle-kit generate` dari entities/ (verbatim, bukan input user).
const UP_SQL = `CREATE TYPE "public"."app_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TABLE "apps" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "apps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"icon_media_url" varchar(512),
	"status" "app_status" DEFAULT 'active' NOT NULL,
	"db_name" varchar(255) NOT NULL,
	"android_package" varchar(255),
	"ios_bundle_id" varchar(255),
	"store_url_android" varchar(512),
	"store_url_ios" varchar(512),
	"fcm_credential" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "apps_slug_uk" ON "apps" USING btree ("slug");`;

export async function up({ db }: MigrationContext): Promise<void> {
  await db.execute(sql.raw(UP_SQL));
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "apps"`);
  await db.execute(sql`DROP TYPE IF EXISTS "public"."app_status"`);
}
