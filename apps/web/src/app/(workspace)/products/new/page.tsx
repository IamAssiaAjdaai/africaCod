import Link from "next/link";
import { PageHeading } from "@africacod/ui";
import { catalog, requireOrganization } from "@/lib/server";
import { found, scalar } from "@/lib/catalog-pages";
import { ProductEditor, StoreChoice } from "@/components/catalog-forms";
export default async function NewProduct({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireOrganization();
  const query = await searchParams;
  const service = catalog();
  const stores = await service.listStores(session.user.id);
  const storeId = scalar(query.storeId) || stores[0]?.id;
  if (!storeId)
    return (
      <section className="panel catalog-empty">
        <h1>Create a store first</h1>
        <p>Products belong to a store.</p>
        <Link href="/stores/new" className="button button-green">
          Create store
        </Link>
      </section>
    );
  await found(service.getStore(session.user.id, storeId));
  const [categories, markets] = await Promise.all([
    service.listCategories(session.user.id, storeId),
    service.listMarkets(session.user.id, storeId),
  ]);
  return (
    <>
      <Link className="back-link" href={`/products?storeId=${storeId}`}>
        ← Products
      </Link>
      <PageHeading
        eyebrow="COMMERCE"
        title="Add Product"
        description="Start with the details. Add commercial offers by market."
      />
      <StoreChoice stores={stores} storeId={storeId} route="/products/new" />
      <ProductEditor
        key={storeId}
        storeId={storeId}
        categories={categories}
        markets={markets}
      />
    </>
  );
}
