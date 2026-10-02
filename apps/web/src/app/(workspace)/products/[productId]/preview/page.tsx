import {
  defaultPageConfig,
  checkoutConfiguration,
  marketToken,
} from "@africacod/domain";
import { currencyDecimals } from "@africacod/shared/money";
import { requireOrganization, storefront } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { PublicProductView } from "@/components/public-product";
export default async function Preview({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { session } = await requireOrganization();
  const { productId } = await params;
  const query = await searchParams;
  const service = storefront();
  const product = await found(service.getProduct(session.user.id, productId));
  const [page, media, store, markets, offers, variants] = await Promise.all([
    service.getProductPage(session.user.id, productId),
    service.listMedia(session.user.id, productId),
    service.getStore(session.user.id, product.storeId),
    service.listMarkets(session.user.id, product.storeId),
    service.listOffers(session.user.id, productId),
    service.listVariants(session.user.id, productId),
  ]);
  const config = page?.draftConfig ?? defaultPageConfig(product, media);
  const eligible = markets.flatMap((market) => {
    const offer = offers.find(
      (offer) =>
        offer.storeMarketId === market.id &&
        offer.status === "active" &&
        offer.currency === market.currency,
    );
    if (market.status !== "active" || !offer) return [];
    try {
      currencyDecimals(offer.currency);
    } catch {
      return [];
    }
    return [{ market, offer }];
  });
  const selected =
    query.market === undefined
      ? eligible.length === 1
        ? eligible[0]
        : undefined
      : eligible.find((row) => marketToken(row.market) === query.market);
  return (
    <PublicProductView
      key={selected?.market.id ?? "choose"}
      preview
      product={{
        ...config,
        storeName: store.name,
        storeSlug: store.slug,
        productSlug: product.slug,
        productName: product.name,
        description: product.description,
        media: config.mediaIds.flatMap((id) => {
          const image = media.find((m) => m.id === id);
          return image
            ? [
                {
                  url: `/api/media/${id}`,
                  altText: image.altText ?? product.name,
                },
              ]
            : [];
        }),
        variants: variants
          .filter((v) => v.status === "active")
          .map((v) => ({ id: v.id, name: v.name })),
        markets: eligible.map(({ market }) => ({
          token: marketToken(market),
          name: market.countryName,
        })),
        selected: selected
          ? {
              token: marketToken(selected.market),
              name: selected.market.countryName,
              currency: selected.offer.currency,
              priceMinor: selected.offer.priceMinor,
              compareAtPriceMinor: selected.offer.compareAtPriceMinor,
              checkout: checkoutConfiguration(selected.market),
            }
          : null,
        invalidMarket: query.market !== undefined && !selected,
      }}
    />
  );
}
