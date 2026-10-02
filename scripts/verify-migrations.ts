import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { migrate } from "../packages/db/node_modules/drizzle-orm/postgres-js/migrator";
import { createDatabase, seedCountries } from "../packages/db/src/index";
import { getDatabaseEnvironment } from "../packages/shared/src/index";
import { sql } from "../packages/db/node_modules/drizzle-orm";
const url = new URL(getDatabaseEnvironment().DATABASE_URL);
if (
  process.env.APP_ENV === "production" ||
  !["localhost", "127.0.0.1"].includes(url.hostname)
)
  throw new Error(
    "Migration verification requires an isolated local PostgreSQL server.",
  );
url.pathname = "/postgres";
const admin = createDatabase(url.toString());
const suffix = `cp9_${Date.now()}`;
const folder = resolve("packages/db/drizzle");
const previous = await mkdtemp(join(tmpdir(), "africacod-upgrade-"));
const journal = JSON.parse(
  await readFile(join(folder, "meta/_journal.json"), "utf8"),
);
await mkdir(join(previous, "meta"));
await writeFile(
  join(previous, "meta/_journal.json"),
  JSON.stringify({
    ...journal,
    entries: journal.entries.filter((e: { idx: number }) => e.idx <= 11),
  }),
);
for (const e of journal.entries.filter((e: { idx: number }) => e.idx <= 11))
  await copyFile(join(folder, `${e.tag}.sql`), join(previous, `${e.tag}.sql`));
try {
  for (const path of ["fresh", "upgrade"]) {
    const name = `${suffix}_${path}`;
    await admin.client.unsafe(`CREATE DATABASE "${name}"`);
    const target = new URL(url);
    target.pathname = `/${name}`;
    const { db, client } = createDatabase(target.toString());
    try {
      if (path === "upgrade") {
        await migrate(db, { migrationsFolder: previous });
        await db.execute(
          sql`INSERT INTO organizations (id,name) VALUES ('11111111-1111-4111-8111-111111111111','Upgrade fixture')`,
        );
        await db.execute(
          sql`INSERT INTO stores (organization_id,name,slug) VALUES ('11111111-1111-4111-8111-111111111111','Upgrade Store','upgrade-fixture')`,
        );
      }
      await migrate(db, { migrationsFolder: folder });
      await seedCountries(db);
      await seedCountries(db);
      const [counts] = await db.execute<{
        tables: number;
        countries: number;
        stores: number;
        markets: number;
      }>(
        sql`SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') AS tables,(SELECT count(*)::int FROM country_definitions) AS countries,(SELECT count(*)::int FROM stores) AS stores,(SELECT count(*)::int FROM store_markets) AS markets`,
      );
      if (
        counts.tables !== 42 ||
        counts.countries !== 252 ||
        counts.stores !== (path === "upgrade" ? 1 : 0) ||
        counts.markets !== 0
      )
        throw new Error(
          "Migration or reference-only seed verification failed.",
        );
      console.info(
        `${path}: 42 tables; 252 reference countries; no automatic markets; fixture preservation verified.`,
      );
    } finally {
      await client.end();
      await admin.client.unsafe(`DROP DATABASE "${name}"`);
    }
  }
} finally {
  await admin.client.end();
  await rm(previous, { recursive: true, force: true });
}
