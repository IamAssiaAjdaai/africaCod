import { countryCatalog } from "@africacod/markets";
import { sql } from "drizzle-orm";
import type { Database } from "./index";
import { countryDefinitions } from "./schema";
export async function seedCountries(db: Database) {
  // Re-running the seed neither resets admin-managed definitions nor assigns store markets.
  await db
    .insert(countryDefinitions)
    .values(countryCatalog)
    .onConflictDoUpdate({
      target: countryDefinitions.code,
      set: {
        continent: sql`excluded.continent`,
        merchantMarketEnabled: sql`excluded.merchant_market_enabled`,
      },
    });
}
