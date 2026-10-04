import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseEnvironment } from "@africacod/shared";
import * as schema from "./schema";
export function createDatabase(url: string) {
  const client = postgres(url, {
    max: 10,
    debug:
      process.env.DATABASE_QUERY_PROFILE === "1" &&
      process.env.APP_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(new URL(url).hostname)
        ? () => console.info("PROFILE_QUERY")
        : undefined,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 20,
    connection: {
      application_name: "africacod",
      statement_timeout: 15000,
      idle_in_transaction_session_timeout: 60000,
    },
  });
  return { db: drizzle(client, { schema }), client };
}
export type Database = ReturnType<typeof createDatabase>["db"];
let connection: ReturnType<typeof createDatabase> | undefined;
export function getDatabase(): Database {
  connection ??= createDatabase(getDatabaseEnvironment().DATABASE_URL);
  return connection.db;
}
export * from "./schema";

export { seedCountries } from "./catalog-seed";

export { ensureInitialWorkspace } from "./workspace";
