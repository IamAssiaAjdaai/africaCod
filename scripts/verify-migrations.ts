import { loadRootEnvironment } from "../packages/shared/src/node";
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
loadRootEnvironment();
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
const suffix = `cp93_${Date.now()}`;
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
    entries: journal.entries.filter((e: { idx: number }) => e.idx <= 13),
  }),
);
for (const e of journal.entries.filter((e: { idx: number }) => e.idx <= 13))
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
          sql`INSERT INTO stores (organization_id,name,slug,tagline,logo) VALUES ('11111111-1111-4111-8111-111111111111','Upgrade Store','upgrade-fixture','Existing identity','22222222-2222-4222-8222-222222222222.png')`,
        );
      }
      await migrate(db, { migrationsFolder: folder });
      // Verify the additive migration itself, before reseeding can repair metadata.
      const [unclassified] = await db.execute<{ total: number }>(
        sql`SELECT count(*)::int AS total FROM country_definitions WHERE continent IS NULL`,
      );
      if (unclassified.total !== 0)
        throw new Error("Country continent migration backfill is incomplete.");
      await seedCountries(db);
      await seedCountries(db);
      const [counts] = await db.execute<{
        tables: number;
        countries: number;
        african: number;
        stores: number;
        markets: number;
      }>(
        sql`SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') AS tables,(SELECT count(*)::int FROM country_definitions) AS countries,(SELECT count(*)::int FROM country_definitions WHERE continent='AF' AND merchant_market_enabled) AS african,(SELECT count(*)::int FROM stores) AS stores,(SELECT count(*)::int FROM store_markets) AS markets`,
      );
      if (
        counts.tables !== 43 ||
        counts.countries !== 252 ||
        counts.african !== 54 ||
        counts.stores !== (path === "upgrade" ? 1 : 0) ||
        counts.markets !== 0
      )
        throw new Error(
          "Migration or reference-only seed verification failed.",
        );
      if (path === "upgrade") {
        const [legacy] = await db.execute<{
          name: string;
          tagline: string;
          logo: string;
          storageKey: string;
          bytes: number | null;
        }>(
          sql`SELECT s.published_settings->'identity'->>'name' AS name,s.published_settings->'identity'->>'tagline' AS tagline,s.published_settings->'identity'->>'logoLight' AS logo,a.storage_key AS "storageKey",a.bytes FROM stores s JOIN store_assets a ON a.store_id=s.id AND a.organization_id=s.organization_id WHERE s.slug='upgrade-fixture'`,
        );
        if (
          legacy.name !== "Upgrade Store" ||
          legacy.tagline !== "Existing identity" ||
          !legacy.logo ||
          legacy.storageKey !== "22222222-2222-4222-8222-222222222222.png" ||
          legacy.bytes !== null
        )
          throw new Error("Legacy published branding/media migration failed.");
      }
      if (path === "upgrade") {
        const [activation] = await db.execute<{ published: boolean }>(
          sql`SELECT settings_published_at IS NOT NULL AS published FROM stores WHERE slug='upgrade-fixture'`,
        );
        if (!activation.published)
          throw new Error("Existing Store publication was not preserved.");
      }
      console.info(
        `${path}: 43 tables; 252 reference countries; 54 African picker countries; no automatic markets; fixture preservation verified.`,
      );
    } finally {
      await client.end();
      await admin.client.unsafe(`DROP DATABASE "${name}"`);
    }
  }
  // Verify the immediate Checkpoint 9.1 schema upgrade independently of the legacy branding upgrade.
  await writeFile(
    join(previous, "meta/_journal.json"),
    JSON.stringify({
      ...journal,
      entries: journal.entries.filter((e: { idx: number }) => e.idx <= 14),
    }),
  );
  await copyFile(
    join(folder, "0014_store_settings_publication.sql"),
    join(previous, "0014_store_settings_publication.sql"),
  );
  const currentName = `${suffix}_current`;
  await admin.client.unsafe(`CREATE DATABASE "${currentName}"`);
  const currentUrl = new URL(url);
  currentUrl.pathname = `/${currentName}`;
  const currentDb = createDatabase(currentUrl.toString());
  try {
    await migrate(currentDb.db, { migrationsFolder: previous });
    await currentDb.db.execute(
      sql`INSERT INTO organizations (id,name) VALUES ('11111111-1111-4111-8111-111111111111','Current schema fixture')`,
    );
    await currentDb.db.execute(
      sql`INSERT INTO stores (organization_id,name,slug) VALUES ('11111111-1111-4111-8111-111111111111','Existing Store','current-fixture')`,
    );
    const [before] = await currentDb.db.execute<{ settings: unknown }>(
      sql`SELECT published_settings AS settings FROM stores WHERE slug='current-fixture'`,
    );
    await migrate(currentDb.db, { migrationsFolder: folder });
    const [after] = await currentDb.db.execute<{
      settings: unknown;
      published: boolean;
    }>(
      sql`SELECT published_settings AS settings,settings_published_at IS NOT NULL AS published FROM stores WHERE slug='current-fixture'`,
    );
    if (
      !after.published ||
      JSON.stringify(before.settings) !== JSON.stringify(after.settings)
    )
      throw new Error(
        "Current schema upgrade changed settings or failed to preserve publication.",
      );
    await currentDb.db.execute(
      sql`INSERT INTO stores (organization_id,name,slug) VALUES ('11111111-1111-4111-8111-111111111111','New Store','new-fixture')`,
    );
    const [newStore] = await currentDb.db.execute<{
      draft: boolean;
      markets: number;
    }>(
      sql`SELECT settings_published_at IS NULL AS draft,(SELECT count(*)::int FROM store_markets) AS markets FROM stores WHERE slug='new-fixture'`,
    );
    if (!newStore.draft || newStore.markets !== 0)
      throw new Error("New Store must be unpublished with zero Markets.");
    console.info(
      "Checkpoint 9.1 upgrade: existing publication preserved; settings unchanged; new Store private with zero Markets.",
    );
  } finally {
    await currentDb.client.end();
    await admin.client.unsafe(`DROP DATABASE "${currentName}"`);
  }
} finally {
  await admin.client.end();
  await rm(previous, { recursive: true, force: true });
}
