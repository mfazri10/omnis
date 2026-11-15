import { sql } from "drizzle-orm";
import type { MigrationContext } from "../../src/database/migration/migration-runner";

// Pernyataan CREATE hasil `drizzle-kit generate` (verbatim, bukan input user).
const CREATE_SQL = `CREATE TABLE "app_configs" (
	"app_id" bigint PRIMARY KEY NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"maintenance_message" text,
	"min_version_android" varchar(32) NOT NULL,
	"min_version_ios" varchar(32) NOT NULL,
	"theme_primary_color" varchar(16) NOT NULL,
	"logo_media_url" varchar(512),
	"support_email" varchar(255),
	"support_whatsapp" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_configs" ADD CONSTRAINT "app_configs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;`;

export async function up({ db }: MigrationContext): Promise<void> {
  // R3: ALTER TYPE ... ADD VALUE TIDAK bisa dalam blok transaksi —
  // dieksekusi sebagai statement terpisah (satu execute() per statement).
  await db.execute(
    sql`ALTER TYPE "public"."app_status" ADD VALUE IF NOT EXISTS 'provisioning'`,
  );
  await db.execute(
    sql`ALTER TYPE "public"."app_status" ADD VALUE IF NOT EXISTS 'failed'`,
  );
  await db.execute(
    sql`ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "failure_reason" text`,
  );
  await db.execute(
    sql`ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "last_provisioning_at" timestamp with time zone`,
  );
  await db.execute(sql.raw(CREATE_SQL));
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "app_configs"`);
  await db.execute(sql`ALTER TABLE "apps" DROP COLUMN IF EXISTS "failure_reason"`);
  await db.execute(
    sql`ALTER TABLE "apps" DROP COLUMN IF EXISTS "last_provisioning_at"`,
  );
  // Nilai enum 'provisioning'/'failed' SENGAJA dibiarkan:
  // Postgres tak mendukung penghapusan nilai enum.
}
