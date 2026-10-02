import { cookies } from "next/headers";
import { runtimeEnvironment } from "@africacod/shared";
import { TrackingConsent } from "@/components/tracking-consent";
import { readConsent, consentCookieName } from "@/lib/consent";
import { Suspense } from "react";
import { site } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { StoreShell } from "@/components/store-shell";
export default async function StoreLayout({
  params,
  children,
}: {
  params: Promise<{ storeSlug: string }>;
  children: React.ReactNode;
}) {
  const { storeSlug } = await params;
  const store = await found(site().getPublicStore(storeSlug));
  const preference = (await cookies()).get(consentCookieName(storeSlug))?.value;
  return (
    <Suspense
      fallback={<main className="public-storefront">Loading storefront…</main>}
    >
      <TrackingConsent
        storeSlug={storeSlug}
        initial={readConsent(storeSlug, preference)}
        required={runtimeEnvironment().CONSENT_MODE === "required"}
        hasPreference={!!preference}
      >
        <StoreShell store={store}>{children}</StoreShell>
      </TrackingConsent>
    </Suspense>
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await found(site().getPublicStore(storeSlug));
  return {
    title: { default: store.name, template: `%s | ${store.name}` },
    description: store.tagline ?? `Shop ${store.name} with cash on delivery.`,
  };
}
