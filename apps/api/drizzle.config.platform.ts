import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/modules/platform/**/entities/*.ts",
  out: "./migrations/platform",
  dialect: "postgresql",
});
