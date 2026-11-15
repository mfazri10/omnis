#!/usr/bin/env bun
/**
 * Seed 2 aplikasi demo untuk verifikasi F05 (dev only).
 * F03 menggantikan ini dengan provisionApp sungguhan.
 *
 *   cd apps/api
 *   bun run seed:demo-apps
 */
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DatabaseService } from "../database/database.service";
import { apps } from "../modules/platform/entities/apps.entity";

loadDotenv({ path: resolve(__dirname, "..", "..", ".env") });

const DEMO_APPS = [
  { name: "Tes CPNS", slug: "tes-cpns", dbName: "app_tes_cpns" },
  { name: "Ngewarung", slug: "ngewarung", dbName: "app_ngewarung" },
];

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const database = app.get(DatabaseService);
    const db = database.getControlPlaneConnection();
    let inserted = 0;
    for (const demo of DEMO_APPS) {
      const existing = await db
        .select({ id: apps.id })
        .from(apps)
        .where(eq(apps.slug, demo.slug))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(apps).values(demo);
        inserted += 1;
      }
    }
    console.log(`disisipkan: ${inserted}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
