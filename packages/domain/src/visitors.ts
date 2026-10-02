import { and, eq, gte, sql, lt } from "drizzle-orm";
import { z } from "zod";
import {
  visitorEvents,
  stores,
  products,
  storeMarkets,
  commerceEvents,
} from "@africacod/db";
import { marketToken } from "./storefront";
import { ContentService } from "./content";
import { DomainError } from "./commerce";
const capture = z
  .object({
    eventId: z.uuid(),
    type: z.enum(["store_view", "product_view", "checkout_started"]),
    productSlug: z.string().min(2).max(100).optional(),
    market: z.string().min(1).max(120).optional(),
  })
  .strict();
export class VisitorService extends ContentService {
  async capture(storeSlug: string, input: unknown) {
    const value = capture.parse(input);
    const [store] = await this.db
      .select()
      .from(stores)
      .where(and(eq(stores.slug, storeSlug), eq(stores.status, "active")));
    if (!store) throw new DomainError("NOT_FOUND", "Store unavailable.");
    if (value.market) {
      const markets = await this.db
        .select()
        .from(storeMarkets)
        .where(
          and(
            eq(storeMarkets.storeId, store.id),
            eq(storeMarkets.organizationId, store.organizationId),
            eq(storeMarkets.status, "active"),
          ),
        );
      if (!markets.some((market) => marketToken(market) === value.market))
        throw new DomainError("NOT_FOUND", "Market unavailable.");
    }
    let productId: string | null = null;
    if (value.type !== "store_view") {
      if (!value.productSlug)
        throw new DomainError("INVALID_INPUT", "Product required.");
      const publicProduct = await this.getPublicProduct(
        storeSlug,
        value.productSlug,
        value.market,
      );
      if (!publicProduct.selected)
        throw new DomainError("NOT_FOUND", "Choose an available market.");
      const [product] = await this.db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.storeId, store.id),
            eq(products.organizationId, store.organizationId),
            eq(products.slug, value.productSlug),
          ),
        );
      productId = product.id;
    }
    if (value.type === "product_view")
      await this.db
        .insert(commerceEvents)
        .values({
          id: `view:${value.eventId}`,
          organizationId: store.organizationId,
          storeId: store.id,
          type: "product_viewed",
          occurredAt: new Date(),
        })
        .onConflictDoNothing();
    await this.db
      .insert(visitorEvents)
      .values({
        id: value.eventId,
        organizationId: store.organizationId,
        storeId: store.id,
        productId,
        marketToken: value.market ?? null,
        type: value.type,
      })
      .onConflictDoNothing();
  }
  async observations(
    userId: string | null,
    storeId: string,
    from: Date,
    to: Date,
  ) {
    const store = await this.getStore(userId, storeId);
    return this.db
      .select({ type: visitorEvents.type, count: sql<number>`count(*)::int` })
      .from(visitorEvents)
      .where(
        and(
          eq(visitorEvents.organizationId, store.organizationId),
          eq(visitorEvents.storeId, store.id),
          gte(visitorEvents.occurredAt, from),
          lt(visitorEvents.occurredAt, to),
        ),
      )
      .groupBy(visitorEvents.type);
  }
  async prune(now = new Date()) {
    await this.db
      .delete(commerceEvents)
      .where(
        and(
          eq(commerceEvents.type, "product_viewed"),
          lt(
            commerceEvents.occurredAt,
            new Date(now.getTime() - 30 * 86400000),
          ),
        ),
      );
    await this.db
      .delete(visitorEvents)
      .where(
        lt(visitorEvents.occurredAt, new Date(now.getTime() - 30 * 86400000)),
      );
  }
}
