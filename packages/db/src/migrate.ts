import { loadRootEnvironment } from "@africacod/shared/node";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./index";
import { getDatabaseEnvironment } from "@africacod/shared";
loadRootEnvironment();
const { db, client } = createDatabase(getDatabaseEnvironment().DATABASE_URL);
try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  console.info("Migrations applied.");
} finally {
  await client.end();
}
