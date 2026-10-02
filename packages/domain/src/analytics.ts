import { and, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import {
  orders,
  orderItems,
  shipments,
  stores,
  storeMarkets,
  products,
} from "@africacod/db";
import { OperationsService } from "./operations";
import { DomainError } from "./commerce";
const filters = z.object({
  range: z.enum(["today", "yesterday", "7d", "30d", "custom"]).default("7d"),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  storeId: z.uuid().optional(),
  marketId: z.uuid().optional(),
  productId: z.uuid().optional(),
});
export function analyticsRange(
  value: z.infer<typeof filters>,
  now = new Date(),
) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  let from: Date, to: Date;
  if (value.range === "custom") {
    if (!value.from || !value.to)
      throw new DomainError("INVALID_INPUT", "Choose both custom dates.");
    from = new Date(value.from);
    to = new Date(new Date(value.to).getTime() + 86400000);
  } else {
    from = new Date(
      today.getTime() -
        (value.range === "yesterday"
          ? 1
          : value.range === "7d"
            ? 6
            : value.range === "30d"
              ? 29
              : 0) *
          86400000,
    );
    to = new Date(
      today.getTime() + (value.range === "yesterday" ? 0 : 86400000),
    );
  }
  if (to <= from || to.getTime() - from.getTime() > 366 * 86400000)
    throw new DomainError(
      "INVALID_INPUT",
      "Choose a date range of at most 366 days.",
    );
  return { from, to };
}
export type AnalyticsMetrics = {
  orders: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  refused: number;
  returned: number;
  confirmationRate: number;
  deliveryRate: number;
  submitted: Record<string, number>;
  revenue: Record<string, number>;
};
export class AnalyticsService extends OperationsService {
  async analytics(
    userId: string | null,
    value: unknown = {},
    now = new Date(),
  ) {
    const org = await this.tenant(userId),
      f = filters.parse(value),
      range = analyticsRange(f, now);
    if (f.storeId) await this.getStore(userId, f.storeId);
    if (f.productId) await this.getProduct(userId, f.productId);
    if (f.marketId) {
      const [m] = await this.db
        .select()
        .from(storeMarkets)
        .where(
          and(
            eq(storeMarkets.id, f.marketId),
            eq(storeMarkets.organizationId, org.id),
          ),
        );
      if (!m) throw new DomainError("NOT_FOUND", "Market not found.");
    }
    const rows = await this.db
      .select({ order: orders, shipment: shipments, store: stores.name })
      .from(orders)
      .innerJoin(stores, eq(stores.id, orders.storeId))
      .leftJoin(shipments, eq(shipments.orderId, orders.id))
      .where(
        and(
          eq(orders.organizationId, org.id),
          gte(orders.createdAt, range.from),
          lt(orders.createdAt, range.to),
          f.storeId ? eq(orders.storeId, f.storeId) : undefined,
          f.marketId ? eq(orders.storeMarketId, f.marketId) : undefined,
        ),
      );
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.organizationId, org.id));
    const selected = rows.filter(
      (r) =>
        !f.productId ||
        items.some(
          (i) => i.orderId === r.order.id && i.productId === f.productId,
        ),
    );
    const metrics = (
      group: typeof rows,
      productId?: string,
    ): AnalyticsMetrics => {
      const submitted: Record<string, number> = {},
        revenue: Record<string, number> = {};
      for (const { order: o, shipment: s } of group) {
        const total = productId
          ? items
              .filter((i) => i.orderId === o.id && i.productId === productId)
              .reduce((v, i) => v + i.lineTotalMinor, 0)
          : o.totalMinor;
        submitted[o.currency] = (submitted[o.currency] ?? 0) + total;
        if (s?.status === "delivered")
          revenue[o.currency] = (revenue[o.currency] ?? 0) + total;
      }
      const confirmed = group.filter(
          (r) => r.order.confirmedAt !== null,
        ).length,
        delivered = group.filter(
          (r) => r.shipment?.status === "delivered",
        ).length;
      return {
        orders: group.length,
        confirmed,
        shipped: group.filter(
          (r) =>
            r.shipment?.shippedAt !== null &&
            r.shipment?.shippedAt !== undefined,
        ).length,
        delivered,
        refused: group.filter((r) => r.shipment?.status === "refused").length,
        returned: group.filter((r) => r.shipment?.status === "returned").length,
        confirmationRate: group.length ? confirmed / group.length : 0,
        deliveryRate: group.length ? delivered / group.length : 0,
        submitted,
        revenue,
      };
    };
    const byStore = [...new Set(selected.map((r) => r.order.storeId))].map(
      (id) => ({
        id,
        name: selected.find((r) => r.order.storeId === id)!.store,
        metrics: metrics(selected.filter((r) => r.order.storeId === id)),
      }),
    );
    const byMarket = [
      ...new Set(selected.map((r) => r.order.storeMarketId)),
    ].map((id) => ({
      id,
      name: selected.find((r) => r.order.storeMarketId === id)!.order
        .marketName,
      metrics: metrics(selected.filter((r) => r.order.storeMarketId === id)),
    }));
    const byProduct = [
      ...new Set(
        items
          .filter(
            (i) =>
              selected.some((r) => r.order.id === i.orderId) &&
              (!f.productId || i.productId === f.productId),
          )
          .map((i) => i.productId),
      ),
    ].map((id) => ({
      id,
      name: items.find((i) => i.productId === id)!.productName,
      metrics: metrics(
        selected.filter((r) =>
          items.some((i) => i.orderId === r.order.id && i.productId === id),
        ),
        id,
      ),
    }));
    return { range, metrics: metrics(selected), byStore, byMarket, byProduct };
  }
  async options(userId: string | null) {
    const org = await this.tenant(userId);
    return {
      stores: await this.listStores(userId),
      markets: await this.db
        .select({ id: storeMarkets.id, name: storeMarkets.name })
        .from(storeMarkets)
        .where(eq(storeMarkets.organizationId, org.id)),
      products: await this.db
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(eq(products.organizationId, org.id)),
    };
  }
}
