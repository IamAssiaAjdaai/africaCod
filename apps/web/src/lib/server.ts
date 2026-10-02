import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@africacod/auth";
import {
  CommerceService,
  CatalogService,
  StorefrontService,
  ContentService,
  AppsService,
  OperationsService,
  ProviderService,
} from "@africacod/domain";
import { getDatabase } from "@africacod/db";
export function commerce() {
  return new CommerceService(getDatabase());
}
export async function requireSession() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session;
}
export async function requireOrganization() {
  const session = await requireSession();
  const organization = await commerce().organizationFor(session.user.id);
  if (!organization) redirect("/onboarding");
  return { session, organization };
}

export function catalog() {
  return new CatalogService(getDatabase());
}

export function storefront() {
  return new StorefrontService(getDatabase());
}

export function site() {
  return new ContentService(getDatabase());
}
export function apps() {
  return new AppsService(getDatabase());
}

export function operations() {
  return new OperationsService(getDatabase());
}

export function providerTestMode() {
  return process.env.PROVIDER_TEST_MODE === "1";
}
export function providers() {
  return new ProviderService(getDatabase(), {
    testMode: providerTestMode(),
    encryptionKey: process.env.PROVIDER_CREDENTIALS_KEY,
  });
}
