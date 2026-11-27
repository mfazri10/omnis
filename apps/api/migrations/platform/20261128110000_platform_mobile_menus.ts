import { sql } from "drizzle-orm";
import type { MigrationContext } from "../../src/database/migration/migration-runner";

const UP_SQL = `CREATE TABLE "menus" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menus_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"app_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"route_key" varchar(255),
	"icon_key" varchar(255),
	"parent_id" bigint,
	"order_no" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "menus_app_slug_uk" ON "menus" USING btree ("app_id","slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "menus_app_id_id_uk" ON "menus" USING btree ("app_id","id");
--> statement-breakpoint
CREATE INDEX "menus_app_parent_idx" ON "menus" USING btree ("app_id","parent_id");
--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_app_fk" FOREIGN KEY ("app_id","parent_id") REFERENCES "public"."menus"("app_id","id") ON DELETE restrict ON UPDATE no action;`;

export async function up({ db }: MigrationContext): Promise<void> {
  await db.execute(sql.raw(UP_SQL));
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "menus"`);
}
