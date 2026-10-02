import { defineConfig } from "drizzle-kit";
import { getDatabaseEnvironment } from "@africacod/shared";
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: getDatabaseEnvironment().DATABASE_URL },
});
