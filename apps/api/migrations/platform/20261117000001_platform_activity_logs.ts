import { sql } from "drizzle-orm";
import type { MigrationContext } from "../../src/database/migration/migration-runner";

// SQL hasil `drizzle-kit generate` dari entities/ (verbatim, bukan input user).
// Hanya pernyataan tabel `activity_logs` yang disalin: tabel lain sudah
// diterapkan migrasi sebelumnya (journal generate tak dilacak, konvensi F01).
const UP_SQL = `CREATE TABLE "activity_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"admin_id" bigint NOT NULL,
	"app_id" bigint,
	"action" varchar(32) NOT NULL,
	"entity_type" varchar(64),
	"entity_id" varchar(64),
	"summary" text NOT NULL,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_logs_app_created_idx" ON "activity_logs" USING btree ("app_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_logs_admin_created_idx" ON "activity_logs" USING btree ("admin_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_logs_entity_idx" ON "activity_logs" USING btree ("entity_type","entity_id");`;

export async function up({ db }: MigrationContext): Promise<void> {
  await db.execute(sql.raw(UP_SQL));
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "activity_logs"`);
}
