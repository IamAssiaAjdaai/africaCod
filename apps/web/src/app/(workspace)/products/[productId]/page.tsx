import { defaultPageConfig } from "@africacod/domain";
import { PageEditor } from "@/components/page-editor";
import Link from "next/link";
import { PageHeading } from "@africacod/ui";
import { catalog, storefront, requireOrganization } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { ProductEditor } from "@/components/catalog-forms";
import { ProductSectionNavigation } from "@/components/product-section-navigation";
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
    <div className="product-editor-page">
      <Link className="back-link" href={`/products?storeId=${store.id}`}>
        ← Products
      </Link>
      <PageHeading
        eyebrow={store.name}
        title={product.name}
        description="Shared product details for this store. Independent prices and offers for each market."
      />
      <ProductSectionNavigation
        productStatus={product.status}
        offerCount={offers.length}
        mediaCount={media.length}
        variantCount={variants.length}
        published={page?.status === "published"}
      />
      {!offers.some((o) => o.status === "active") && (
        <section className="panel product-next-step">
          <h2>Next: configure Market pricing</h2>
          <p>
            Set your own price for an active Market below. Publish the Product
            Page, then return to Store Settings to Preview and Publish your
            Store.
          </p>
          <div className="form-actions">
            <a className="button button-green" href="#market-offers">
              Set market pricing
            </a>
            <Link
              className="button button-outline"
              href={`/stores/${store.id}/settings`}
            >
              Store Settings
            </Link>
          </div>
        </section>
      )}
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
      {!store.settingsPublishedAt && (
        <p className="muted">
          Your Store is Draft. Product Page publication prepares this Product;
          publish the Store in{" "}
          <Link href={`/stores/${store.id}/settings`}>Store Settings</Link>{" "}
          before sharing its public URL.
        </p>
      )}
      <PageEditor
        productId={product.id}
        config={page?.draftConfig ?? defaultPageConfig(product, media)}
        media={media}
        published={page?.status === "published"}
        publicUrl={`/s/${store.slug}/p/${product.slug}`}
      />
    </div>
  );
}
