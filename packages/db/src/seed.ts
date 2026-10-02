import { countryCatalog } from "@africacod/markets";
import { getDatabaseEnvironment } from "@africacod/shared";
import { createDatabase, countryDefinitions } from "./index";
export async function seedCountries(
  db: ReturnType<typeof createDatabase>["db"],
) {
  // Re-running the seed neither resets admin-managed definitions nor assigns store markets.
  await db
    .insert(countryDefinitions)
    .values(countryCatalog)
    .onConflictDoNothing();
}
const { db, client } = createDatabase(getDatabaseEnvironment().DATABASE_URL);
try {
  await seedCountries(db);
  console.info("Country catalog seeded. No store markets created.");
} finally {
  await client.end();
}
