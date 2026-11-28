#!/usr/bin/env bun
/**
 * Seed menu mobile default untuk setiap aplikasi terdaftar.
 * Struktur mengikuti menu aplikasi CMS saat ini: Dasbor, Pengguna, Media,
 * Notifikasi, Pengaturan, plus grup CBT (Soal/Paket/Sesi/Hasil) bila
 * aplikasi memasang modul cbt.
 *
 * Idempoten: baris dengan (app_id, slug) yang sudah ada dilewati, jadi
 * aman dijalankan ulang dan tidak menimpa penyesuaian admin.
 *
 *   cd apps/api
 *   bun src/scripts/seed-mobile-menus.ts
 */
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DatabaseService } from "../database/database.service";
import { apps } from "../modules/platform/entities/apps.entity";
import { menus } from "../modules/platform/entities/mobile-menus.entity";

loadDotenv({ path: resolve(__dirname, "..", "..", ".env") });

interface SeedItem {
  name: string;
  slug: string;
  routeKey: string | null;
  iconKey: string;
  orderNo: number;
  children?: SeedItem[];
}

const BASE_MENU: SeedItem[] = [
  { name: "Dasbor", slug: "dasbor", routeKey: "dashboard", iconKey: "home", orderNo: 0 },
  { name: "Pengguna", slug: "pengguna", routeKey: "users", iconKey: "users", orderNo: 1 },
  { name: "Media", slug: "media", routeKey: "media", iconKey: "images", orderNo: 2 },
  { name: "Notifikasi", slug: "notifikasi", routeKey: "notifications", iconKey: "bell", orderNo: 3 },
  { name: "Pengaturan", slug: "pengaturan", routeKey: "settings", iconKey: "settings", orderNo: 4 },
];

const CBT_GROUP: SeedItem = {
  name: "CBT",
  slug: "cbt",
  routeKey: null,
  iconKey: "clipboard-list",
  orderNo: 5,
  children: [
    { name: "Soal", slug: "soal", routeKey: "cbt.questions", iconKey: "file-question", orderNo: 0 },
    { name: "Paket", slug: "paket", routeKey: "cbt.packages", iconKey: "package", orderNo: 1 },
    { name: "Sesi", slug: "sesi", routeKey: "cbt.sessions", iconKey: "calendar-clock", orderNo: 2 },
    { name: "Hasil", slug: "hasil", routeKey: "cbt.results", iconKey: "clipboard-check", orderNo: 3 },
  ],
};

async function insertMenu(
  db: ReturnType<DatabaseService["getControlPlaneConnection"]>,
  appId: number,
  item: SeedItem,
  parentId: number | null,
): Promise<number> {
  const inserted = await db
    .insert(menus)
    .values({
      appId,
      name: item.name,
      slug: item.slug,
      routeKey: item.routeKey,
      iconKey: item.iconKey,
      parentId,
      orderNo: item.orderNo,
      isActive: true,
    })
    .onConflictDoNothing({ target: [menus.appId, menus.slug] })
    .returning({ id: menus.id });
  if (inserted.length > 0) {
    return inserted[0]!.id;
  }
  const existing = await db
    .select({ id: menus.id })
    .from(menus)
    .where(and(eq(menus.appId, appId), eq(menus.slug, item.slug)))
    .limit(1);
  return existing[0]!.id;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const database = app.get(DatabaseService);
    const db = database.getControlPlaneConnection();
    const allApps = await db.select({ id: apps.id, modules: apps.modules }).from(apps);
    let total = 0;
    for (const current of allApps) {
      const before = await db.$count(menus, eq(menus.appId, current.id));
      const items = [...BASE_MENU];
      if (current.modules.includes("cbt")) {
        items.push(CBT_GROUP);
      }
      for (const item of items) {
        const parentId = await insertMenu(db, current.id, item, null);
        for (const child of item.children ?? []) {
          await insertMenu(db, current.id, child, parentId);
        }
      }
      const after = await db.$count(menus, eq(menus.appId, current.id));
      total += after - before;
      console.log(`app #${current.id}: ${after} menu (modul: ${current.modules.join(", ") || "tanpa modul"})`);
    }
    console.log(`disisipkan: ${total}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
