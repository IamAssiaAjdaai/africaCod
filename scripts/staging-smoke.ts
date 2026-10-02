import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { migrate } from "../packages/db/node_modules/drizzle-orm/postgres-js/migrator";
import { createDatabase, seedCountries } from "../packages/db/src/index";
import { getDatabaseEnvironment } from "../packages/shared/src/index";
const url = new URL(getDatabaseEnvironment().DATABASE_URL);
if (
  process.env.APP_ENV === "production" ||
  !["localhost", "127.0.0.1"].includes(url.hostname)
)
  throw new Error(
    "Smoke runner requires isolated local database infrastructure.",
  );
url.pathname = "/postgres";
const admin = createDatabase(url.toString());
const name = `cp9_smoke_${Date.now()}`;
await admin.client.unsafe(`CREATE DATABASE "${name}"`);
const target = new URL(url);
target.pathname = `/${name}`;
const database = createDatabase(target.toString());
try {
  await migrate(database.db, {
    migrationsFolder: resolve("packages/db/drizzle"),
  });
  await seedCountries(database.db);
  await database.client.end();
  const env = {
    ...process.env,
    APP_ENV: "staging",
    GOOGLE_CLIENT_ID: "staging-oauth-client",
    GOOGLE_CLIENT_SECRET: "staging-oauth-secret",
    DATABASE_URL: target.toString(),
    BETTER_AUTH_URL: "http://localhost:3100",
    BETTER_AUTH_SECRET: randomBytes(48).toString("base64"),
    PROVIDER_CREDENTIALS_KEY: randomBytes(32).toString("base64"),
    INTEGRATION_CREDENTIALS_KEY: randomBytes(32).toString("base64"),
    RATE_LIMIT_KEY: randomBytes(48).toString("base64"),
    PROVIDER_TEST_MODE: "0",
    TRACKING_TEST_MODE: "0",
    CONSENT_MODE: "required",
  };
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "corepack",
      [
        "pnpm",
        "exec",
        "playwright",
        "test",
        "--config",
        "playwright.smoke.config.ts",
      ],
      { env, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Staging smoke failed.")),
    );
  });
  console.info(
    "Fresh database application boot and manual COD lifecycle smoke passed with both integration test adapters disabled.",
  );
} finally {
  await database.client.end();
  await admin.client.unsafe(`DROP DATABASE "${name}"`);
  await admin.client.end();
}
