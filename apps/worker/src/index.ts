import { createDatabase } from "@africacod/db";
import { ProviderService } from "@africacod/domain";
import { getDatabaseEnvironment } from "@africacod/shared";
const { db, client } = createDatabase(getDatabaseEnvironment().DATABASE_URL);
const service = new ProviderService(db, {
  testMode: process.env.PROVIDER_TEST_MODE === "1",
  encryptionKey: process.env.PROVIDER_CREDENTIALS_KEY,
});
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stopping = true;
  });
console.info("Provider worker running; production ShipCOD remains blocked.");
try {
  do {
    try {
      if (!(await service.runOne()))
        await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      console.error(
        "Provider worker tick failed; no credentials or response payload logged.",
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } while (!stopping && !process.argv.includes("--once"));
} finally {
  await client.end();
}
