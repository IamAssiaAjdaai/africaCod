import { DashboardDisclosure as WorkspaceDisclosure } from "@/components/dashboard-disclosure";
import { StoreSetup } from "@/components/store-setup";
import Link from "next/link";
import { StoreSettingsEditor } from "@/components/store-settings-editor";
import {
  requireOrganization,
  storeSettings,
  storeSetup,
  site,
} from "@/lib/server";
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
      service.listMerchantCountries(session.user.id),
      service.listCategories(session.user.id, storeId),
      service.listProducts(session.user.id, storeId),
      site().listContentPages(session.user.id, storeId),
    ]);
  const setup = await storeSetup(session.user.id, storeId);
  return (
    <div className="store-settings-page">
      <Link className="back-link" href={`/stores/${storeId}`}>
        ← {store.name}
      </Link>
      <WorkspaceDisclosure
        title="Store readiness"
        description={`${store.name} · setup checklist and store address`}
        className="store-settings-setup"
      >
        <StoreSetup store={store} userId={session.user.id} settingsPage />
      </WorkspaceDisclosure>
      <StoreSettingsEditor
        storeId={storeId}
        name={store.name}
        readyToPublish={setup.pricing && store.status === "active"}
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
    </div>
  );
}
