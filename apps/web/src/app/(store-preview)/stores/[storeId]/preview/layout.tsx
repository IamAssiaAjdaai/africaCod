import Link from "next/link";
import { Suspense } from "react";
import { requireOrganization, storeSettings, site } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { StoreShell } from "@/components/store-shell";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const { session } = await requireOrganization();
  const store = await found(storeSettings().getStore(session.user.id, storeId));
  return {
    robots: { index: false, follow: false },
    title: "Private Store preview",
    icons: store.draftSettings.identity.favicon
      ? {
          icon: `/api/stores/${store.id}/assets/${store.draftSettings.identity.favicon}?w=320`,
        }
      : undefined,
  };
}
export default async function PreviewLayout({
  params,
  children,
}: {
  params: Promise<{ storeId: string }>;
  children: React.ReactNode;
}) {
  const { storeId } = await params;
  const { session } = await requireOrganization();
  const store = await found(storeSettings().getStore(session.user.id, storeId));
  const draft = await found(site().getPublicStore(store.slug, session.user.id));
  if (!draft.markets.length)
    return (
      <main className="public-storefront">
        <h1>Preview unavailable</h1>
        <p>Add a market to preview your Store.</p>
        <Link
          className="button button-green"
          href={`/stores/${storeId}#store-markets`}
        >
          Add Market
        </Link>
      </main>
    );
  return (
    <>
      <p className="preview-banner">
        Private Draft preview · Checkout and visitor tracking are disabled ·{" "}
        <Link href={`/stores/${storeId}/settings`}>Back to Store Settings</Link>
      </p>
      <Suspense fallback={<p>Loading preview…</p>}>
        <StoreShell store={draft} previewBase={`/stores/${storeId}/preview`}>
          {children}
        </StoreShell>
      </Suspense>
    </>
  );
}
