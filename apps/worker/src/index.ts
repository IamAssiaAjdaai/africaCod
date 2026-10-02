import { createDatabase } from "@africacod/db";
import { ProviderService, TrackingService } from "@africacod/domain";
import { getDatabaseEnvironment } from "@africacod/shared";
const { db, client } = createDatabase(getDatabaseEnvironment().DATABASE_URL);
const service = new ProviderService(db, {
  testMode: process.env.PROVIDER_TEST_MODE === "1",
  encryptionKey: process.env.PROVIDER_CREDENTIALS_KEY,
});
const tracking = new TrackingService(db, {
  testMode: process.env.TRACKING_TEST_MODE === "1",
  encryptionKey: process.env.INTEGRATION_CREDENTIALS_KEY,
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
      const providerWorked = await service.runOne();
      const trackingWorked = await tracking.runOne();
      if (!providerWorked && !trackingWorked)
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
