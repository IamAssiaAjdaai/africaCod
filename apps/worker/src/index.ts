import { logEvent } from "@africacod/shared";
import { AbuseService } from "@africacod/domain";
import { oauthStates } from "@africacod/db";
import { lt } from "drizzle-orm";
import { runtimeEnvironment } from "@africacod/shared";
import { VisitorService } from "@africacod/domain";
import { createDatabase } from "@africacod/db";
import { ProviderService, TrackingService } from "@africacod/domain";
import { getDatabaseEnvironment } from "@africacod/shared";
const runtime = runtimeEnvironment();
const { db, client } = createDatabase(getDatabaseEnvironment().DATABASE_URL);
const service = new ProviderService(db, {
  testMode: runtime.PROVIDER_TEST_MODE === "1",
  encryptionKey: process.env.PROVIDER_CREDENTIALS_KEY,
});
const tracking = new TrackingService(db, {
  testMode: runtime.TRACKING_TEST_MODE === "1",
  google:
    runtime.GOOGLE_CLIENT_ID && runtime.GOOGLE_CLIENT_SECRET
      ? {
          clientId: runtime.GOOGLE_CLIENT_ID,
          clientSecret: runtime.GOOGLE_CLIENT_SECRET,
          redirectUri: new URL(
            "/api/integrations/google/callback",
            runtime.BETTER_AUTH_URL,
          ).toString(),
        }
      : undefined,
  consentRequired: runtime.CONSENT_MODE === "required",
  encryptionKey: process.env.INTEGRATION_CREDENTIALS_KEY,
});
const visitors = new VisitorService(db);
let lastVisitorPrune = 0;
let lastHealth = 0;
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stopping = true;
  });
logEvent("info", "worker.started", { code: runtime.APP_ENV });
try {
  do {
    try {
      if (Date.now() - lastVisitorPrune > 86400000) {
        await visitors.prune();
        await new AbuseService(db).prune();
        await db
          .delete(oauthStates)
          .where(lt(oauthStates.expiresAt, new Date()));
        lastVisitorPrune = Date.now();
      }
      if (Date.now() - lastHealth > 60000) {
        logEvent("info", "worker.healthy");
        lastHealth = Date.now();
      }
      const providerWorked = await service.runOne();
      const trackingWorked = await tracking.runOne();
      if (!providerWorked && !trackingWorked)
        await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      logEvent("error", "worker.tick_failed");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } while (!stopping && !process.argv.includes("--once"));
} finally {
  await client.end();
}
