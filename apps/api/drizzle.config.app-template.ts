import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/modules/shared/**/entities/*.ts"],
  out: "./migrations/app-template",
  dialect: "postgresql",
});
