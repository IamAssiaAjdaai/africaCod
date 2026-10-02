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
  return (
    <Suspense
      fallback={<main className="public-storefront">Loading storefront…</main>}
    >
      <StoreShell store={store}>{children}</StoreShell>
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
