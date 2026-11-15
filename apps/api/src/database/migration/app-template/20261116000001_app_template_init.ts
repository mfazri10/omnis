import { sql } from "drizzle-orm";
import type { MigrationContext } from "../migration-runner";

// SQL hasil `drizzle-kit generate` dari entities/ template (verbatim, bukan input user).
const UP_SQL = `CREATE TYPE "public"."device_platform" AS ENUM('android', 'ios');--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "device_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint,
	"token" varchar(512) NOT NULL,
	"platform" "device_platform" NOT NULL,
	"app_version" varchar(32),
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"uploaded_by_admin_id" bigint,
	"file_name" varchar(255) NOT NULL,
	"path" varchar(512) NOT NULL,
	"url" varchar(512) NOT NULL,
	"mime_type" varchar(127) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"alt_text" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(32),
	"avatar_url" varchar(512),
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_token_uk" ON "device_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uk" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uk" ON "users" USING btree ("phone");`;

export async function up({ db }: MigrationContext): Promise<void> {
  await db.execute(sql.raw(UP_SQL));
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "device_tokens"`);
  await db.execute(sql`DROP TABLE IF EXISTS "media"`);
  await db.execute(sql`DROP TABLE IF EXISTS "users"`);
  await db.execute(sql`DROP TYPE IF EXISTS "public"."device_platform"`);
}
