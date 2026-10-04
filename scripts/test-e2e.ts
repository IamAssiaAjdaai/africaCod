import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { migrate } from "../packages/db/node_modules/drizzle-orm/postgres-js/migrator";
import { createDatabase, seedCountries } from "../packages/db/src/index";
import { getDatabaseEnvironment } from "../packages/shared/src/index";
import { loadRootEnvironment } from "../packages/shared/src/node";
loadRootEnvironment();
const application = new URL(getDatabaseEnvironment().DATABASE_URL);
if (
  process.env.APP_ENV === "production" ||
  !["localhost", "127.0.0.1"].includes(application.hostname)
)
  throw new Error(
    "Browser verification requires an isolated local PostgreSQL database.",
  );
const databaseName = `africacod_e2e_${Date.now()}_test`;
const adminUrl = new URL(application);
adminUrl.pathname = "/postgres";
const admin = createDatabase(adminUrl.toString());
let created = false;
try {
  await admin.client.unsafe(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const target = new URL(application);
  target.pathname = `/${databaseName}`;
  const isolated = createDatabase(target.toString());
  try {
    await migrate(isolated.db, {
      migrationsFolder: fileURLToPath(
        new URL("../packages/db/drizzle", import.meta.url),
      ),
    });
    await seedCountries(isolated.db);
  } finally {
    await isolated.client.end();
  }
  console.info(
    "Browser tests use a fresh, isolated local database; development workers remain untouched.",
  );
  const child = spawn(
    "corepack",
    ["pnpm", "exec", "playwright", "test", ...process.argv.slice(2)],
    {
      env: { ...process.env, DATABASE_URL: target.toString(), APP_ENV: "test" },
      stdio: "inherit",
    },
  );
  const forward = () => child.kill("SIGTERM");
  process.once("SIGTERM", forward);
  process.once("SIGINT", forward);
  const [code] = await once(child, "exit");
  process.removeListener("SIGTERM", forward);
  process.removeListener("SIGINT", forward);
  process.exitCode = typeof code === "number" ? code : 1;
} finally {
  if (created)
    await admin.client.unsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.client.end();
}
