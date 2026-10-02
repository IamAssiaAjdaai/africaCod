import { storefront, tracking } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { PublicProductView } from "@/components/public-product";
export default async function PublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string; productSlug: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { storeSlug, productSlug } = await params;
  const query = await searchParams;
  const product = await found(
    storefront().getPublicProduct(
      storeSlug,
      productSlug,
      Array.isArray(query.market) ? "" : query.market,
    ),
  );
  return (
    <PublicProductView
      key={product.selected?.token ?? "choose"}
      product={product}
      tracking={await tracking().publicTracking(storeSlug)}
    />
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string; productSlug: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { storeSlug, productSlug } = await params;
  const query = await searchParams;
  const product = await found(
    storefront().getPublicProduct(
      storeSlug,
      productSlug,
      Array.isArray(query.market) ? "" : query.market,
    ),
  );
  return {
    title: product.productName,
    description:
      product.subtitle || product.description?.slice(0, 300) || undefined,
  };
}
