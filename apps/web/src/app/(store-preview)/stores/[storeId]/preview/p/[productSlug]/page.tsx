import { requireOrganization, storeSettings, storefront } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { marketParam } from "@/lib/store-pages";
import { PublicProductView } from "@/components/public-product";
export default async function PreviewProduct({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string; productSlug: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { storeId, productSlug } = await params;
  const query = await searchParams;
  const { session } = await requireOrganization();
  const store = await found(storeSettings().getStore(session.user.id, storeId));
  const product = await found(
    storefront().getPublicProduct(
      store.slug,
      productSlug,
      marketParam(query.market),
      session.user.id,
    ),
  );
  return (
    <PublicProductView
      key={product.selected?.token}
      product={{
        ...product,
        settings: store.draftSettings,
        storeName: store.draftSettings.identity.name ?? store.name,
      }}
      preview
    />
  );
}
