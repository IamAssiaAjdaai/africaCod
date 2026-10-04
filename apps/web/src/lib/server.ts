import { enforceActionRateLimit } from "./rate-limit";
import { runtimeEnvironment, logEvent } from "@africacod/shared";
import "server-only";
import { cache } from "react";
import { VisitorService } from "@africacod/domain";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@africacod/auth";
import {
  GoogleSheetsService,
  StoreSettingsService,
  DashboardService,
  CommerceService,
  CatalogService,
  StorefrontService,
  ContentService,
  AppsService,
  OperationsService,
  ProviderService,
  TrackingService,
  AnalyticsService,
} from "@africacod/domain";
import { getDatabase } from "@africacod/db";
// Request-scoped only: never cache a tenant across requests.
const organizationFor = cache((userId: string) =>
  new CommerceService(getDatabase()).organizationFor(userId),
);
export function commerce() {
  return new CommerceService(getDatabase(), organizationFor);
}
export const readSession = cache(async () => {
  const requestHeaders = await headers();
  try {
    return await getAuth().api.getSession({ headers: requestHeaders });
  } catch {
    logEvent("error", "auth.session_unavailable");
    throw new Error("Authentication temporarily unavailable.");
  }
});
export async function requireSession() {
  await enforceActionRateLimit();
  const session = await readSession();
  if (!session) redirect("/sign-in");
  return session;
}
export const requireOrganization = cache(async () => {
  const session = await requireSession();
  const organization = await commerce().organizationFor(session.user.id);
  if (!organization) redirect("/onboarding");
  return { session, organization };
});

export function catalog() {
  return new CatalogService(getDatabase(), organizationFor);
}

export function storefront() {
  return new StorefrontService(getDatabase(), organizationFor);
}

export function site() {
  const service = new ContentService(getDatabase(), organizationFor);
  service.getPublicStore = (slug, previewUser) =>
    readStoreProjection(slug, previewUser);
  return service;
}
export function apps() {
  return new AppsService(getDatabase());
}

export function operations() {
  return new OperationsService(getDatabase(), organizationFor);
}

export function providerTestMode() {
  return runtimeEnvironment().PROVIDER_TEST_MODE === "1";
}
export function providers() {
  return new ProviderService(getDatabase(), {
    testMode: providerTestMode(),
    encryptionKey: process.env.PROVIDER_CREDENTIALS_KEY,
  });
}

export function trackingTestMode() {
  return runtimeEnvironment().TRACKING_TEST_MODE === "1";
}
export function tracking() {
  return new TrackingService(getDatabase(), {
    testMode: trackingTestMode(),
    google: googleConfig(),
    consentRequired: runtimeEnvironment().CONSENT_MODE === "required",
    encryptionKey: process.env.INTEGRATION_CREDENTIALS_KEY,
  });
}
export function analytics() {
  return new AnalyticsService(getDatabase(), organizationFor);
}

export function visitors() {
  return new VisitorService(getDatabase(), organizationFor);
}

export function googleConfig() {
  const env = runtimeEnvironment();
  return env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: new URL(
          "/api/integrations/google/callback",
          env.BETTER_AUTH_URL,
        ).toString(),
      }
    : undefined;
}
export function googleSheets() {
  return new GoogleSheetsService(
    getDatabase(),
    process.env.INTEGRATION_CREDENTIALS_KEY,
    googleConfig(),
  );
}

export function storeSettings() {
  return new StoreSettingsService(getDatabase(), organizationFor);
}
export function dashboard() {
  return new DashboardService(getDatabase(), organizationFor);
}

const readStoreProjection = cache((slug: string, previewUser?: string) =>
  new ContentService(getDatabase(), organizationFor).getPublicStore(
    slug,
    previewUser,
  ),
);
export const storeSetup = cache((userId: string, storeId: string) =>
  storeSettings().setup(userId, storeId),
);
