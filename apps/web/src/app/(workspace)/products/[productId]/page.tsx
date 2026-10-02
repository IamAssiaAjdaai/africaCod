import { defaultPageConfig } from "@africacod/domain";
import { PageEditor } from "@/components/page-editor";
import Link from "next/link";
import { PageHeading } from "@africacod/ui";
import { catalog, storefront, requireOrganization } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { ProductEditor } from "@/components/catalog-forms";
export default async function ProductDetail({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { session } = await requireOrganization();
  const { productId } = await params;
  const service = catalog();
  const product = await found(service.getProduct(session.user.id, productId));
  const [categories, markets, media, variants, offers, store] =
    await Promise.all([
      service.listCategories(session.user.id, product.storeId),
      service.listMarkets(session.user.id, product.storeId),
      service.listMedia(session.user.id, product.id),
      service.listVariants(session.user.id, product.id),
      service.listOffers(session.user.id, product.id),
      service.getStore(session.user.id, product.storeId),
    ]);
  const page = await storefront().getProductPage(session.user.id, product.id);
  return (
    <>
      <Link className="back-link" href={`/products?storeId=${store.id}`}>
        ← Products
      </Link>
      <PageHeading
        eyebrow={store.name}
        title={product.name}
        description="Product details and independent market offers."
      />
      <ProductEditor
        storeId={product.storeId}
        product={product}
        categories={categories}
        markets={markets}
        media={media}
        variants={variants}
        offers={offers}
        published={page?.status === "published"}
      />
      <PageEditor
        productId={product.id}
        config={page?.draftConfig ?? defaultPageConfig(product, media)}
        media={media}
        published={page?.status === "published"}
        publicUrl={`/s/${store.slug}/p/${product.slug}`}
      />
    </>
  );
}
