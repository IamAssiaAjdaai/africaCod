import { loadRootEnvironment } from "@africacod/shared/node";
import { seedCountries } from "./catalog-seed";
import { getDatabaseEnvironment } from "@africacod/shared";
import { createDatabase } from "./index";
loadRootEnvironment();
const { db, client } = createDatabase(getDatabaseEnvironment().DATABASE_URL);
try {
  await seedCountries(db);
  console.info("Country catalog seeded. No store markets created.");
} finally {
  await client.end();
}
