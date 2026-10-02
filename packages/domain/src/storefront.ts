import { createHash } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  lte,
  ilike,
  or,
  sql,
  count,
} from "drizzle-orm";
import { z } from "zod";
import {
  products,
  stores,
  storeMarkets,
  productPages,
  productMedia,
  productVariants,
  productMarketOffers,
  customers,
  orders,
  orderItems,
  orderEvents,
  orderAttribution,
} from "@africacod/db";
import {
  checkoutInput,
  pageConfigInput,
  orderFiltersInput,
  type PageConfig,
} from "@africacod/validation";
import { currencyDecimals } from "@africacod/shared/money";
import { CatalogService } from "./catalog";
import { DomainError } from "./commerce";
import {
  checkoutConfiguration,
  normalizeCheckoutPhone,
  validateCheckoutAddress,
} from "./checkout-configuration";
export function marketToken(market: {
  countryCode: string | null;
  customKey: string | null;
}): string {
  return market.countryCode ?? `custom:${market.customKey}`;
}
const unavailable = () =>
  new DomainError("NOT_FOUND", "This product or market is not available.");
const receipt = (order: typeof orders.$inferSelect) => ({
  orderNumber: order.orderNumber,
  currency: order.currency,
  totalMinor: order.totalMinor,
});
export class StorefrontService extends CatalogService {
  async getProductPage(userId: string | null, productId: string) {
    const product = await this.getProduct(userId, productId);
    const [page] = await this.db
      .select()
      .from(productPages)
      .where(
        and(
          eq(productPages.productId, product.id),
          eq(productPages.organizationId, product.organizationId),
        ),
      )
      .limit(1);
    return page ?? null;
  }
  async savePageDraft(
    userId: string | null,
    productId: string,
    input: unknown,
  ) {
    const product = await this.getProduct(userId, productId);
    const config = pageConfigInput.parse(input);
    const media = await this.listMedia(userId, product.id);
    if (
      new Set(config.mediaIds).size !== config.mediaIds.length ||
      config.mediaIds.some((id) => !media.some((image) => image.id === id))
    )
      throw new DomainError(
        "INVALID_INPUT",
        "Choose only this product’s images, without duplicates.",
      );
    const [page] = await this.db
      .insert(productPages)
      .values({
        productId: product.id,
        organizationId: product.organizationId,
        draftConfig: config,
      })
      .onConflictDoUpdate({
        target: productPages.productId,
        set: { draftConfig: config, updatedAt: new Date() },
      })
      .returning();
    return page;
  }
  async publishPage(userId: string | null, productId: string) {
    const product = await this.getProduct(userId, productId);
    return this.db.transaction(async (tx) => {
      const [currentProduct] = await tx
        .select()
        .from(products)
        .where(
          and(
            eq(products.id, product.id),
            eq(products.organizationId, product.organizationId),
          ),
        )
        .for("update");
      const [store] = await tx
        .select()
        .from(stores)
        .where(
          and(
            eq(stores.id, product.storeId),
            eq(stores.organizationId, product.organizationId),
          ),
        )
        .for("share");
      if (currentProduct.status !== "active" || store.status !== "active")
        throw new DomainError(
          "INVALID_INPUT",
          "Activate the product and store before publishing.",
        );
      const [page] = await tx
        .select()
        .from(productPages)
        .where(
          and(
            eq(productPages.productId, product.id),
            eq(productPages.organizationId, product.organizationId),
          ),
        )
        .for("update");
      if (!page)
        throw new DomainError(
          "INVALID_INPUT",
          "Save the storefront draft first.",
        );
      const media = await tx
        .select()
        .from(productMedia)
        .where(
          and(
            eq(productMedia.productId, product.id),
            eq(productMedia.organizationId, product.organizationId),
          ),
        );
      if (
        page.draftConfig.mediaIds.some(
          (id) => !media.some((image) => image.id === id),
        )
      )
        throw new DomainError(
          "INVALID_INPUT",
          "A draft image was removed. Update the draft before publishing.",
        );
      const publishedConfig = {
        ...structuredClone(page.draftConfig),
        productName: currentProduct.name,
        description: currentProduct.description,
        media: page.draftConfig.mediaIds.map((id) => {
          const image = media.find((row) => row.id === id)!;
          return {
            id: image.id,
            storageKey: image.storageKey,
            mimeType: image.mimeType,
            altText: image.altText,
          };
        }),
      };
      const [published] = await tx
        .update(productPages)
        .set({
          status: "published",
          publishedConfig,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productPages.id, page.id),
            eq(productPages.organizationId, product.organizationId),
          ),
        )
        .returning();
      return published;
    });
  }
  async unpublishPage(userId: string | null, productId: string) {
    const product = await this.getProduct(userId, productId);
    await this.db
      .update(productPages)
      .set({ status: "draft", updatedAt: new Date() })
      .where(
        and(
          eq(productPages.productId, product.id),
          eq(productPages.organizationId, product.organizationId),
        ),
      );
  }
  async getPublicProduct(
    storeSlug: string,
    productSlug: string,
    requestedMarket?: string,
  ) {
    const [resolved] = await this.db
      .select({ store: stores, product: products, page: productPages })
      .from(stores)
      .innerJoin(
        products,
        and(
          eq(products.storeId, stores.id),
          eq(products.organizationId, stores.organizationId),
        ),
      )
      .innerJoin(
        productPages,
        and(
          eq(productPages.productId, products.id),
          eq(productPages.organizationId, products.organizationId),
        ),
      )
      .where(
        and(
          eq(stores.slug, storeSlug),
          eq(products.slug, productSlug),
          eq(stores.status, "active"),
          eq(products.status, "active"),
          eq(productPages.status, "published"),
        ),
      )
      .limit(1);
    if (!resolved?.page.publishedConfig) throw unavailable();
    const { store, product, page } = resolved;
    const [available, variants] = await Promise.all([
      this.db
        .select({
          market: storeMarkets,
          priceMinor: productMarketOffers.priceMinor,
          compareAtPriceMinor: productMarketOffers.compareAtPriceMinor,
          currency: productMarketOffers.currency,
        })
        .from(storeMarkets)
        .innerJoin(
          productMarketOffers,
          and(
            eq(productMarketOffers.storeMarketId, storeMarkets.id),
            eq(productMarketOffers.productId, product.id),
            eq(productMarketOffers.storeId, store.id),
            eq(productMarketOffers.organizationId, store.organizationId),
          ),
        )
        .where(
          and(
            eq(storeMarkets.storeId, store.id),
            eq(storeMarkets.organizationId, store.organizationId),
            eq(storeMarkets.status, "active"),
            eq(productMarketOffers.status, "active"),
            eq(productMarketOffers.currency, storeMarkets.currency),
          ),
        )
        .orderBy(asc(storeMarkets.name)),
      this.db
        .select({ id: productVariants.id, name: productVariants.name })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, product.id),
            eq(productVariants.organizationId, product.organizationId),
            eq(productVariants.status, "active"),
          ),
        )
        .orderBy(
          asc(productVariants.sortOrder),
          asc(productVariants.createdAt),
        ),
    ]);
    const eligible = available.filter((row) => {
      try {
        currencyDecimals(row.currency);
        return true;
      } catch {
        return false;
      }
    });
    const selected =
      requestedMarket !== undefined
        ? eligible.find((row) => marketToken(row.market) === requestedMarket)
        : eligible.length === 1
          ? eligible[0]
          : undefined;
    const config = page.publishedConfig!;
    // Explicit projection: no cost, tenant IDs, storage keys or prices for unselected markets.
    return {
      storeName: store.name,
      storeSlug,
      productSlug,
      productName: config.productName,
      description: config.description,
      headline: config.headline,
      subtitle: config.subtitle,
      benefits: config.benefits,
      trustMessage: config.trustMessage,
      ctaLabel: config.ctaLabel,
      media: config.media.map((image) => ({
        url: `/s/${storeSlug}/p/${productSlug}/media/${image.id}`,
        altText: image.altText ?? config.productName,
      })),
      variants,
      markets: eligible.map((row) => ({
        token: marketToken(row.market),
        name: row.market.name,
      })),
      selected: selected
        ? {
            token: marketToken(selected.market),
            name: selected.market.name,
            currency: selected.currency,
            priceMinor: selected.priceMinor,
            compareAtPriceMinor: selected.compareAtPriceMinor,
            checkout: checkoutConfiguration(selected.market),
          }
        : null,
      invalidMarket: requestedMarket !== undefined && !selected,
    };
  }
  async getPublicMedia(
    storeSlug: string,
    productSlug: string,
    mediaId: string,
  ) {
    const [row] = await this.db
      .select({ config: productPages.publishedConfig })
      .from(stores)
      .innerJoin(
        products,
        and(
          eq(products.storeId, stores.id),
          eq(products.organizationId, stores.organizationId),
        ),
      )
      .innerJoin(
        productPages,
        and(
          eq(productPages.productId, products.id),
          eq(productPages.organizationId, products.organizationId),
        ),
      )
      .where(
        and(
          eq(stores.slug, storeSlug),
          eq(products.slug, productSlug),
          eq(stores.status, "active"),
          eq(products.status, "active"),
          eq(productPages.status, "published"),
        ),
      )
      .limit(1);
    const media = row?.config?.media.find((image) => image.id === mediaId);
    if (!media) throw unavailable();
    return media;
  }
  async checkout(
    storeSlug: string,
    productSlug: string,
    idempotencyKey: string,
    input: unknown,
    userAgent: string | null = null,
  ) {
    z.uuid().parse(idempotencyKey);
    const value = checkoutInput.parse(input);
    return this.db.transaction(async (tx) => {
      const [store] = await tx
        .select()
        .from(stores)
        .where(eq(stores.slug, storeSlug))
        .for("share")
        .limit(1);
      if (!store) throw unavailable();
      const [product] = await tx
        .select()
        .from(products)
        .where(
          and(
            eq(products.storeId, store.id),
            eq(products.organizationId, store.organizationId),
            eq(products.slug, productSlug),
          ),
        )
        .for("share")
        .limit(1);
      if (!product) throw unavailable();
      // Transaction-scoped lock serializes retries, including simultaneous requests.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${store.id}:${idempotencyKey}`}, 0))`,
      );
      const markets = await tx
        .select()
        .from(storeMarkets)
        .where(
          and(
            eq(storeMarkets.storeId, store.id),
            eq(storeMarkets.organizationId, store.organizationId),
          ),
        )
        .for("share");
      const market = markets.find((row) => marketToken(row) === value.market);
      if (!market) throw unavailable();
      const configuration = checkoutConfiguration(market);
      const phone = normalizeCheckoutPhone(value.phone, configuration);
      validateCheckoutAddress(value, configuration);
      const requestHash = createHash("sha256")
        .update(
          JSON.stringify({
            productId: product.id,
            marketId: market.id,
            variantId: value.variantId,
            quantity: value.quantity,
            name: value.name,
            phone,
            region: value.region,
            city: value.city,
            address: value.address,
          }),
        )
        .digest("hex");
      const [existing] = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.storeId, store.id),
            eq(orders.checkoutIdempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new DomainError(
            "CONFLICT",
            "This checkout key was already used for different order details. Start a new order.",
          );
        return receipt(existing);
      }
      const [page] = await tx
        .select()
        .from(productPages)
        .where(
          and(
            eq(productPages.productId, product.id),
            eq(productPages.organizationId, store.organizationId),
          ),
        )
        .for("share")
        .limit(1);
      if (
        store.status !== "active" ||
        product.status !== "active" ||
        page?.status !== "published" ||
        !page.publishedConfig ||
        market.status !== "active"
      )
        throw unavailable();
      const [offer] = await tx
        .select()
        .from(productMarketOffers)
        .where(
          and(
            eq(productMarketOffers.productId, product.id),
            eq(productMarketOffers.storeMarketId, market.id),
            eq(productMarketOffers.storeId, store.id),
            eq(productMarketOffers.organizationId, store.organizationId),
            eq(productMarketOffers.status, "active"),
          ),
        )
        .for("share")
        .limit(1);
      if (!offer || offer.currency !== market.currency) throw unavailable();
      try {
        currencyDecimals(offer.currency);
      } catch {
        throw unavailable();
      }
      let variant: typeof productVariants.$inferSelect | undefined;
      if (value.variantId) {
        [variant] = await tx
          .select()
          .from(productVariants)
          .where(
            and(
              eq(productVariants.id, value.variantId),
              eq(productVariants.productId, product.id),
              eq(productVariants.organizationId, store.organizationId),
              eq(productVariants.status, "active"),
            ),
          )
          .for("share")
          .limit(1);
        if (!variant) throw unavailable();
      }
      const total = BigInt(offer.priceMinor) * BigInt(value.quantity);
      if (total > BigInt(Number.MAX_SAFE_INTEGER))
        throw new DomainError("INVALID_INPUT", "Order total is too large.");
      const [customer] = await tx
        .insert(customers)
        .values({
          organizationId: store.organizationId,
          storeId: store.id,
          name: value.name,
          normalizedPhone: phone,
        })
        .onConflictDoUpdate({
          target: [customers.storeId, customers.normalizedPhone],
          set: { name: value.name, updatedAt: new Date() },
        })
        .returning();
      const [recent] = await tx
        .select({ id: orders.id })
        .from(orders)
        .innerJoin(
          orderItems,
          and(
            eq(orderItems.orderId, orders.id),
            eq(orderItems.organizationId, orders.organizationId),
          ),
        )
        .where(
          and(
            eq(orders.customerId, customer.id),
            eq(orders.storeId, store.id),
            eq(orders.storeMarketId, market.id),
            eq(orderItems.productId, product.id),
            gte(orders.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
          ),
        )
        .limit(1);
      const [order] = await tx
        .insert(orders)
        .values({
          organizationId: store.organizationId,
          storeId: store.id,
          storeMarketId: market.id,
          customerId: customer.id,
          orderNumber: `AC-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
          checkoutIdempotencyKey: idempotencyKey,
          requestHash,
          countryCode: market.countryCode,
          marketName: market.name,
          currency: offer.currency,
          customerName: value.name,
          phone,
          region: value.region,
          city: value.city,
          address: value.address,
          subtotalMinor: Number(total),
          shippingFeeMinor: 0,
          totalMinor: Number(total),
          duplicateSignal: Boolean(recent),
        })
        .returning();
      await tx.insert(orderItems).values({
        organizationId: store.organizationId,
        orderId: order.id,
        storeId: store.id,
        storeMarketId: market.id,
        productId: product.id,
        variantId: variant?.id ?? null,
        offerId: offer.id,
        productName: page.publishedConfig.productName,
        variantName: variant?.name ?? null,
        sku: variant?.sku ?? product.sku,
        currency: offer.currency,
        unitPriceMinor: offer.priceMinor,
        unitCostMinor: offer.costMinor,
        quantity: value.quantity,
        lineTotalMinor: Number(total),
      });
      await tx.insert(orderEvents).values({
        organizationId: store.organizationId,
        orderId: order.id,
        status: "new",
        message: "COD order placed",
      });
      const attribution = structuredClone(value.attribution);
      const marketingAllowed =
        process.env.CONSENT_MODE !== "required" || attribution.marketingConsent;
      if (!marketingAllowed) {
        attribution.fbclid = null;
        attribution.fbp = null;
        attribution.fbc = null;
      }
      for (const field of ["landingUrl", "referrer"] as const) {
        if (attribution[field]) {
          const u = new URL(attribution[field]!);
          attribution[field] = u.origin + u.pathname;
        }
      }
      await tx.insert(orderAttribution).values({
        ...attribution,
        organizationId: store.organizationId,
        orderId: order.id,
        userAgent: marketingAllowed
          ? (userAgent?.slice(0, 1000) ?? null)
          : null,
      });
      return receipt(order);
    });
  }
  async getCustomer(userId: string | null, customerId: string) {
    const org = await this.tenant(userId);
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, z.uuid().parse(customerId)),
          eq(customers.organizationId, org.id),
        ),
      )
      .limit(1);
    if (!customer) throw new DomainError("NOT_FOUND", "Customer not found.");
    return customer;
  }
  async getOrder(userId: string | null, orderId: string) {
    const org = await this.tenant(userId);
    const [order] = await this.db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, z.uuid().parse(orderId)),
          eq(orders.organizationId, org.id),
        ),
      )
      .limit(1);
    if (!order) throw new DomainError("NOT_FOUND", "Order not found.");
    const [items, events, attribution, store] = await Promise.all([
      this.db
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, order.id),
            eq(orderItems.organizationId, org.id),
          ),
        ),
      this.db
        .select()
        .from(orderEvents)
        .where(
          and(
            eq(orderEvents.orderId, order.id),
            eq(orderEvents.organizationId, org.id),
          ),
        )
        .orderBy(asc(orderEvents.createdAt)),
      this.db
        .select()
        .from(orderAttribution)
        .where(
          and(
            eq(orderAttribution.orderId, order.id),
            eq(orderAttribution.organizationId, org.id),
          ),
        ),
      this.getStore(userId, order.storeId),
    ]);
    return { order, items, events, attribution: attribution[0] ?? null, store };
  }
  async listOrders(userId: string | null, input: unknown = {}) {
    const org = await this.tenant(userId);
    const filter = orderFiltersInput.parse(input);
    if (filter.storeId) await this.getStore(userId, filter.storeId);
    const conditions = and(
      eq(orders.organizationId, org.id),
      filter.storeId ? eq(orders.storeId, filter.storeId) : undefined,
      filter.marketId ? eq(orders.storeMarketId, filter.marketId) : undefined,
      filter.status ? eq(orders.status, filter.status) : undefined,
      filter.dateFrom
        ? gte(orders.createdAt, new Date(`${filter.dateFrom}T00:00:00Z`))
        : undefined,
      filter.dateTo
        ? lte(orders.createdAt, new Date(`${filter.dateTo}T23:59:59.999Z`))
        : undefined,
      filter.search
        ? or(
            ilike(
              orders.orderNumber,
              `%${filter.search.replace(/[\\%_]/g, "\\$&")}%`,
            ),
            ilike(
              orders.phone,
              `%${filter.search.replace(/[\\%_]/g, "\\$&")}%`,
            ),
            ilike(
              orders.customerName,
              `%${filter.search.replace(/[\\%_]/g, "\\$&")}%`,
            ),
          )
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select({
          order: orders,
          storeName: stores.name,
          productName: orderItems.productName,
        })
        .from(orders)
        .innerJoin(
          stores,
          and(eq(stores.id, orders.storeId), eq(stores.organizationId, org.id)),
        )
        .innerJoin(
          orderItems,
          and(
            eq(orderItems.orderId, orders.id),
            eq(orderItems.organizationId, org.id),
          ),
        )
        .where(conditions)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(20)
        .offset((filter.page - 1) * 20),
      this.db.select({ total: count() }).from(orders).where(conditions),
    ]);
    return { rows, total: totals[0].total, page: filter.page, pageSize: 20 };
  }
  async orderMetrics(userId: string | null) {
    const org = await this.tenant(userId);
    const [totals, values] = await Promise.all([
      this.db
        .select({
          total: count(),
          newOrders: sql<number>`count(*) filter (where ${orders.status} = 'new')::int`,
        })
        .from(orders)
        .where(eq(orders.organizationId, org.id)),
      this.db
        .select({
          currency: orders.currency,
          totalMinor: sql<string>`sum(${orders.totalMinor})::text`,
        })
        .from(orders)
        .where(and(eq(orders.organizationId, org.id), eq(orders.status, "new")))
        .groupBy(orders.currency),
    ]);
    return { ...totals[0], values };
  }
}
export type PublicProduct = Awaited<
  ReturnType<StorefrontService["getPublicProduct"]>
>;
export function defaultPageConfig(
  product: { name: string; shortDescription: string | null },
  media: { id: string }[],
): PageConfig {
  return {
    headline: product.name,
    subtitle: product.shortDescription ?? "",
    benefits: [],
    trustMessage: "Pay when your order arrives.",
    ctaLabel: "Order with cash on delivery",
    mediaIds: media.map((image) => image.id),
  };
}
