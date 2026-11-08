#!/usr/bin/env bun
/**
 * Seed Super Admin pertama (F01).
 *
 *   cd apps/api
 *   bun run seed:admin -- --email=admin@contoh.id --password=minimal8karakter --name="Super Admin" --super
 *
 * Flag --super wajib ditulis eksplisit sebagai konfirmasi.
 */
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { AuthService } from "../auth/auth.service";

loadDotenv({ path: resolve(__dirname, "..", "..", ".env") });

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  const email = readArg("email");
  const password = readArg("password");
  const name = readArg("name") ?? "Super Admin";
  if (!email || !email.includes("@")) {
    throw new Error("Argumen --email=<email-valid> wajib diisi.");
  }
  if (!password || password.length < 8) {
    throw new Error("Argumen --password=<minimal-8-karakter> wajib diisi.");
  }
  if (!hasFlag("super")) {
    throw new Error("Tulis flag --super eksplisit untuk membuat Super Admin.");
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const auth = app.get(AuthService);
    const admin = await auth.createAdminAccount({
      name,
      email,
      password,
      isSuperAdmin: true,
    });
    console.log(`Super Admin dibuat: ${admin.email} (id: ${admin.id})`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
