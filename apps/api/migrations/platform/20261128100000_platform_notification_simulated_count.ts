import { sql } from "drizzle-orm";
import type { MigrationContext } from "../../src/database/migration/migration-runner";

export async function up({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`ALTER TABLE "notification_campaigns" ADD COLUMN "simulated_count" integer DEFAULT 0 NOT NULL`);
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`ALTER TABLE "notification_campaigns" DROP COLUMN "simulated_count"`);
}
