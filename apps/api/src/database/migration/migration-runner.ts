import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Db = NodePgDatabase;
export interface MigrationContext {
  db: Db;
}
export interface MigrationModule {
  up: (ctx: MigrationContext) => Promise<void>;
  down: (ctx: MigrationContext) => Promise<void>;
}

export interface AppliedMigration {
  name: string;
  checksum: string;
}

const MIGRATION_LOCK_ID = 7364291;
const MIGRATIONS_ROOT = resolve(__dirname, "..", "..", "..", "migrations");
// Scope app-template tinggal di src agar terkompilasi ke dist:
// saga provisioning menjalankannya IN-PROCESS baik via bun (src/.ts)
// maupun node (dist/.js). Scope platform hanya via CLI bun.
const APP_TEMPLATE_DIR = resolve(__dirname, "app-template");
const FILE_PATTERN = /^\d{14}_.+\.(ts|js)$/;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function isValidDbName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function scopeDir(scope: string): string {
  if (scope === "app-template") {
    return APP_TEMPLATE_DIR;
  }
  return join(MIGRATIONS_ROOT, scope);
}

/**
 * Pool untuk satu database target. Scope app wajib menyebut --db eksplisit
 * sampai fleet dispatch (iterasi registry) dibangun di F03.
 */
export function poolForScope(scope: string, dbName?: string): Pool {
  if (scope === "platform") {
    return new Pool({
      connectionString: requireEnv("CONTROL_PLANE_DB_URL"),
    });
  }
  if (!dbName || !isValidDbName(dbName)) {
    throw new Error(
      `Scope "${scope}" membutuhkan --db=<nama_database> yang valid.`,
    );
  }
  const base = requireEnv("POSTGRES_BASE_URL");
  return new Pool({ connectionString: `${base}/${dbName}` });
}

/**
 * Advisory lock WAJIB berjalan di satu koneksi khusus (bukan pool),
 * karena lock Postgres bersifat session-level.
 */
export async function withMigrationConnection<T>(
  pool: Pool,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    const db = drizzle(client);
    await db.execute(sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`);
    try {
      return await fn(db);
    } finally {
      await db.execute(sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`);
    }
  } finally {
    client.release();
  }
}

export async function ensureRegistryTable(db: Db): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name varchar(255) NOT NULL UNIQUE,
      checksum varchar(64) NOT NULL,
      executed_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function listMigrationFiles(scope: string): Promise<string[]> {
  const files = await readdir(scopeDir(scope)).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  });
  return files
    .filter((f) => FILE_PATTERN.test(f) && !f.endsWith(".d.ts"))
    .sort();
}

export async function checksumFile(scope: string, file: string): Promise<string> {
  const bytes = await readFile(join(scopeDir(scope), file));
  return createHash("sha256").update(bytes).digest("hex");
}

export async function getApplied(db: Db): Promise<AppliedMigration[]> {
  const result = await db.execute(
    sql`SELECT name, checksum FROM schema_migrations ORDER BY name ASC`,
  );
  return result.rows as unknown as AppliedMigration[];
}

function loadModule(scope: string, file: string): MigrationModule {
  // require() jalur absolut (bukan import file://): hasil kompilasi tsc
  // adalah CJS di mana dynamic import() diturunkan menjadi require()
  // yang MENOLAK URL file://. require() bekerja di node (.js) maupun
  // bun (.ts) karena path absolut biasa.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(join(scopeDir(scope), file)) as Partial<MigrationModule>;
  if (typeof mod.up !== "function" || typeof mod.down !== "function") {
    throw new Error(`Migrasi "${file}" wajib mengekspor fungsi up dan down.`);
  }
  return { up: mod.up, down: mod.down };
}

/** Validasi checksum + larangan sisip retroaktif (doc 12 §8). */
export async function validateHistory(
  scope: string,
  applied: AppliedMigration[],
  files: string[],
): Promise<void> {
  for (const row of applied) {
    if (!files.includes(row.name)) {
      throw new Error(
        `Migrasi "${row.name}" sudah diterapkan tetapi filenya hilang.`,
      );
    }
    const current = await checksumFile(scope, row.name);
    if (current !== row.checksum) {
      throw new Error(
        `Checksum mismatch: "${row.name}" diubah setelah diterapkan. ` +
          `Buat migrasi baru, jangan edit yang lama.`,
      );
    }
  }
  const lastApplied = applied.map((a) => a.name).sort().pop();
  if (lastApplied) {
    const appliedSet = new Set(applied.map((a) => a.name));
    for (const file of files) {
      if (file < lastApplied && !appliedSet.has(file)) {
        throw new Error(
          `Migrasi "${file}" lebih tua dari "${lastApplied}" yang sudah diterapkan.`,
        );
      }
    }
  }
}

export async function migrateUp(scope: string, db: Db): Promise<string[]> {
  await ensureRegistryTable(db);
  const files = await listMigrationFiles(scope);
  const applied = await getApplied(db);
  await validateHistory(scope, applied, files);
  const appliedSet = new Set(applied.map((a) => a.name));
  const pending = files.filter((f) => !appliedSet.has(f));
  const done: string[] = [];
  for (const file of pending) {
    const mod = loadModule(scope, file);
    await mod.up({ db });
    await db.execute(
      sql`INSERT INTO schema_migrations (name, checksum) VALUES (${file}, ${await checksumFile(scope, file)})`,
    );
    done.push(file);
  }
  return done;
}

export async function migrateDown(
  scope: string,
  db: Db,
  steps: number,
): Promise<string[]> {
  await ensureRegistryTable(db);
  const files = await listMigrationFiles(scope);
  const applied = await getApplied(db);
  await validateHistory(scope, applied, files);
  const targets = [...applied]
    .sort((a, b) => (a.name < b.name ? 1 : -1))
    .slice(0, steps);
  const done: string[] = [];
  for (const row of targets) {
    const mod = loadModule(scope, row.name);
    await mod.down({ db });
    await db.execute(
      sql`DELETE FROM schema_migrations WHERE name = ${row.name}`,
    );
    done.push(row.name);
  }
  return done;
}
