import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseEnvironment } from "@africacod/shared";
import * as schema from "./schema";
export function createDatabase(url: string) {
  const client = postgres(url, { max: 10, prepare: false });
  return { db: drizzle(client, { schema }), client };
}
export type Database = ReturnType<typeof createDatabase>["db"];
let connection: ReturnType<typeof createDatabase> | undefined;
export function getDatabase(): Database {
  connection ??= createDatabase(getDatabaseEnvironment().DATABASE_URL);
  return connection.db;
}
export * from "./schema";
