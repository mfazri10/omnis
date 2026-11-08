#!/usr/bin/env bun
/**
 * CLI migrasi single-database (doc 12, slice F00).
 * Fleet dispatch ke semua App DB menyusul di F03.
 *
 *   cd apps/api
 *   bun run db:migrate up --scope platform
 *   bun run db:migrate up --scope app-template --db app_tes_cpns
 *   bun run db:migrate down --scope platform --steps 1
 *   bun run db:migrate status --scope platform
 */
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import {
  ensureRegistryTable,
  getApplied,
  listMigrationFiles,
  migrateDown,
  migrateUp,
  poolForScope,
  withMigrationConnection,
} from "./migration-runner";

loadDotenv({ path: resolve(__dirname, "..", "..", "..", "..", ".env") });

type Command = "up" | "down" | "status";

function parseArgs(argv: string[]): {
  command: Command;
  scope: string;
  db?: string;
  steps: number;
} {
  const [command, ...rest] = argv;
  if (command !== "up" && command !== "down" && command !== "status") {
    throw new Error(`Perintah tidak dikenal: ${String(command)} (up|down|status)`);
  }
  let scope = "platform";
  let db: string | undefined;
  let steps = 1;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i] ?? "";
    if (arg === "--scope") {
      scope = rest[i + 1] ?? scope;
      i += 1;
    } else if (arg === "--db") {
      db = rest[i + 1];
      i += 1;
    } else if (arg === "--steps") {
      steps = Number(rest[i + 1] ?? 1);
      i += 1;
    }
  }
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error("--steps harus bilangan bulat >= 1");
  }
  return { command, scope, db, steps };
}

async function main(): Promise<void> {
  const { command, scope, db, steps } = parseArgs(process.argv.slice(2));
  const pool = poolForScope(scope, db);
  try {
    await withMigrationConnection(pool, async (connection) => {
      if (command === "status") {
        await ensureRegistryTable(connection);
        const files = await listMigrationFiles(scope);
        const applied = await getApplied(connection);
        const appliedNames = new Set(applied.map((a) => a.name));
        const pending = files.filter((f) => !appliedNames.has(f));
        console.log(`Scope: ${scope}`);
        console.log(`Applied (${applied.length}):`);
        for (const row of applied) {
          console.log(`  [x] ${row.name}`);
        }
        console.log(`Pending (${pending.length}):`);
        for (const file of pending) {
          console.log(`  [ ] ${file}`);
        }
        return;
      }
      if (command === "up") {
        const done = await migrateUp(scope, connection);
        console.log(
          done.length === 0
            ? "Sudah terbaru, tidak ada migrasi pending."
            : `Diterapkan (${done.length}):\n${done.map((f) => `  + ${f}`).join("\n")}`,
        );
        return;
      }
      const done = await migrateDown(scope, connection, steps);
      console.log(
        done.length === 0
          ? "Tidak ada migrasi untuk di-rollback."
          : `Di-rollback (${done.length}):\n${done.map((f) => `  - ${f}`).join("\n")}`,
      );
    });
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
