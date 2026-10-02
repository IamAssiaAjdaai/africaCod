import { countryCatalog } from "@africacod/markets";
import type { Database } from "./index";
import { countryDefinitions } from "./schema";
export async function seedCountries(db: Database) {
  // Re-running the seed neither resets admin-managed definitions nor assigns store markets.
  await db
    .insert(countryDefinitions)
    .values(countryCatalog)
    .onConflictDoNothing();
}
