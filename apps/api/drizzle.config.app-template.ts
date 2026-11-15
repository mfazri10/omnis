import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/modules/shared/**/entities/*.ts"],
  out: "./src/database/migration/app-template",
  dialect: "postgresql",
});
