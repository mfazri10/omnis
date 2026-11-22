import { sql } from "drizzle-orm";
import type { MigrationContext } from "../../src/database/migration/migration-runner";

// F12: registry apps mencatat modul domain terpilih saat provisioning
// supaya retry saga menerapkan migrasi modul yang sama. SQL manual
// sederhana (satu kolom), mengikuti konvensi migrasi TS F06/F10.
const UP_SQL = `ALTER TABLE "apps" ADD COLUMN "modules" jsonb DEFAULT '[]'::jsonb NOT NULL;`;

export async function up({ db }: MigrationContext): Promise<void> {
  await db.execute(sql.raw(UP_SQL));
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`ALTER TABLE "apps" DROP COLUMN IF EXISTS "modules"`);
}
