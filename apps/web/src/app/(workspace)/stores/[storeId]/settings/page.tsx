import Link from "next/link";
import { StoreSettingsEditor } from "@/components/store-settings-editor";
import { requireOrganization, storeSettings, site } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
export default async function Settings({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const { session } = await requireOrganization();
  const service = storeSettings();
  const store = await found(service.getStore(session.user.id, storeId));
  const [settings, markets, countries, categories, products, pages] =
    await Promise.all([
      service.settings(session.user.id, storeId),
      service.listMarkets(session.user.id, storeId),
      service.listCountries(session.user.id),
      service.listCategories(session.user.id, storeId),
      service.listProducts(session.user.id, storeId),
      site().listContentPages(session.user.id, storeId),
    ]);
  return (
    <>
      <Link className="back-link" href={`/stores/${storeId}`}>
        ← {store.name}
      </Link>
      <StoreSettingsEditor
        storeId={storeId}
        name={store.name}
        initial={{
          ...settings,
          publishedAt: settings.publishedAt?.toISOString() ?? null,
        }}
        markets={markets}
        countries={countries}
        categories={categories
          .filter((c) => c.status === "active")
          .map((c) => ({ id: c.id, name: c.name }))}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        pages={pages
          .filter((p) => p.status === "published" && p.publishedContent)
          .map((p) => ({ id: p.id, name: p.publishedContent!.title }))}
      />
    </>
  );
}
