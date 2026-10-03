import Link from "next/link";
import { Suspense } from "react";
import { requireOrganization, storeSettings, site } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { StoreShell } from "@/components/store-shell";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Private Store preview",
};
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
