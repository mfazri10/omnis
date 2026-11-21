import { sql } from "drizzle-orm";
import type { MigrationContext } from "../../src/database/migration/migration-runner";

// SQL hasil `drizzle-kit generate` dari entities/ (verbatim, bukan input user).
// Hanya pernyataan tabel `export_jobs` yang disalin: tabel lain
// sudah diterapkan migrasi sebelumnya (journal generate tak dilacak,
// konvensi F01, pola migrasi F06).
const UP_SQL = `CREATE TABLE "export_jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "export_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"requested_by" bigint NOT NULL,
	"source" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"app_slug" varchar(64),
	"filter" jsonb NOT NULL,
	"row_count" integer,
	"file_name" varchar(255),
	"file_size_bytes" bigint,
	"error_message" varchar(512),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_admins_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "export_jobs_requested_by_status_idx" ON "export_jobs" USING btree ("requested_by","status");--> statement-breakpoint
CREATE INDEX "export_jobs_status_expires_idx" ON "export_jobs" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "export_jobs_status_updated_idx" ON "export_jobs" USING btree ("status","updated_at");`;

export async function up({ db }: MigrationContext): Promise<void> {
  await db.execute(sql.raw(UP_SQL));
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "export_jobs"`);
}
