import { sql } from "drizzle-orm";
import { z } from "zod";
import { AnalyticsService, analyticsRange } from "./analytics";
export type DashboardCounts = {
  orders: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  refused: number;
  returned: number;
  processing: number;
  revenue: Record<string, string>;
};
export type DashboardGroup = DashboardCounts & { id: string; name: string };
type AggregateRow = {
  id: string;
  name: string;
  currency: string;
  orders: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  refused: number;
  returned: number;
  processing: number;
  revenue: string;
};
const empty = (): DashboardCounts => ({
  orders: 0,
  confirmed: 0,
  shipped: 0,
  delivered: 0,
  refused: 0,
  returned: 0,
  processing: 0,
  revenue: {},
});
function fold(rows: AggregateRow[]): DashboardGroup[] {
  const groups = new Map<string, DashboardGroup>();
  for (const row of rows) {
    const group = groups.get(row.id) ?? {
      ...empty(),
      id: row.id,
      name: row.name,
    };
    for (const key of [
      "orders",
      "confirmed",
      "shipped",
      "delivered",
      "refused",
      "returned",
      "processing",
    ] as const)
      group[key] += Number(row[key]);
    if (BigInt(row.revenue))
      group.revenue[row.currency] = (
        BigInt(group.revenue[row.currency] ?? "0") + BigInt(row.revenue)
      ).toString();
    groups.set(row.id, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.orders - a.orders || a.name.localeCompare(b.name),
  );
}
export class DashboardService extends AnalyticsService {
  async overview(userId: string | null, input: unknown = {}, now = new Date()) {
    const org = await this.tenant(userId);
    const f = z
      .object({
        range: z
          .enum(["today", "yesterday", "7d", "30d", "custom"])
          .default("7d"),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        storeId: z.uuid().optional(),
      })
      .parse(input);
    if (f.storeId) await this.getStore(userId, f.storeId);
    const range = analyticsRange(f, now);
    const storeFilter = f.storeId ? sql`AND o.store_id = ${f.storeId}` : sql``;
    const visitorFilter = f.storeId ? sql`AND store_id = ${f.storeId}` : sql``;
    const cohort = sql`WITH cohort AS (SELECT o.*, s.shipment_status, s.shipped_at, s.delivered_at FROM orders o LEFT JOIN shipments s ON s.order_id = o.id AND s.organization_id = o.organization_id WHERE o.organization_id = ${org.id} AND o.created_at >= ${range.from.toISOString()} AND o.created_at < ${range.to.toISOString()} ${storeFilter})`;
    const counts = sql`count(distinct c.id)::int AS orders, count(distinct c.id) FILTER (WHERE c.confirmed_at IS NOT NULL)::int AS confirmed, count(distinct c.id) FILTER (WHERE c.shipped_at IS NOT NULL)::int AS shipped, count(distinct c.id) FILTER (WHERE c.shipment_status = 'delivered')::int AS delivered, count(distinct c.id) FILTER (WHERE c.shipment_status = 'refused')::int AS refused, count(distinct c.id) FILTER (WHERE c.shipment_status = 'returned')::int AS returned, count(distinct c.id) FILTER (WHERE c.order_status IN ('new','confirmed') AND (c.shipment_status IS NULL OR c.shipment_status IN ('created','shipped','out_for_delivery')))::int AS processing`;
    const orderRevenue = sql`coalesce(sum(c.total_minor) FILTER (WHERE c.shipment_status = 'delivered'),0)::text AS revenue`;
    const platform = sql`CASE WHEN a.marketing_consent IS NOT TRUE THEN 'Unknown' WHEN lower(coalesce(a.utm_source,'')) ~ '^(facebook|fb|instagram|ig|meta)$' OR a.fbclid IS NOT NULL THEN 'Meta' WHEN lower(coalesce(a.utm_source,'')) ~ '^(tiktok|tt)$' THEN 'TikTok' WHEN lower(coalesce(a.utm_source,'')) ~ '^(google|adwords|googleads)$' THEN 'Google' WHEN lower(coalesce(a.utm_source,'')) = 'direct' OR (a.utm_source IS NULL AND a.referrer IS NULL AND a.landing_url IS NOT NULL) THEN 'Direct' WHEN a.utm_source IS NULL AND a.referrer IS NULL THEN 'Unknown' ELSE 'Other' END`;
    const [
      totals,
      markets,
      productRows,
      sources,
      visitorRows,
      deliveryRows,
      orderSeries,
      visitorSeries,
      deliverySeries,
    ] = await Promise.all([
      this.db.execute<AggregateRow>(
        sql`${cohort} SELECT 'all' AS id, 'All' AS name, c.currency, ${counts}, ${orderRevenue} FROM cohort c GROUP BY c.currency`,
      ),
      this.db.execute<AggregateRow>(
        sql`${cohort} SELECT c.store_market_id AS id, min(c.market_name) AS name, c.currency, ${counts}, ${orderRevenue} FROM cohort c GROUP BY c.store_market_id, c.currency`,
      ),
      this.db.execute<AggregateRow>(
        sql`${cohort} SELECT i.product_id AS id, min(i.product_name) AS name, i.currency, ${counts}, coalesce(sum(i.line_total_minor) FILTER (WHERE c.shipment_status = 'delivered'),0)::text AS revenue FROM cohort c JOIN order_items i ON i.order_id = c.id AND i.organization_id = c.organization_id GROUP BY i.product_id, i.currency`,
      ),
      this.db.execute<AggregateRow>(
        sql`${cohort} SELECT ${platform} AS id, ${platform} AS name, c.currency, ${counts}, ${orderRevenue} FROM cohort c LEFT JOIN order_attribution a ON a.order_id = c.id AND a.organization_id = c.organization_id GROUP BY ${platform}, c.currency`,
      ),
      this.db.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM visitor_events WHERE organization_id = ${org.id} AND type IN ('store_view','product_view') AND occurred_at >= ${range.from.toISOString()} AND occurred_at < ${range.to.toISOString()} ${visitorFilter}`,
      ),
      this.db.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM shipments s JOIN orders o ON o.id = s.order_id AND o.organization_id = s.organization_id WHERE o.organization_id = ${org.id} AND s.shipment_status = 'delivered' AND s.delivered_at >= ${range.from.toISOString()} AND s.delivered_at < ${range.to.toISOString()} ${storeFilter}`,
      ),
      this.db.execute<{ day: string; count: number }>(
        sql`${cohort} SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, count(*)::int AS count FROM cohort GROUP BY day`,
      ),
      this.db.execute<{ day: string; count: number }>(
        sql`SELECT to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, count(*)::int AS count FROM visitor_events WHERE organization_id = ${org.id} AND type IN ('store_view','product_view') AND occurred_at >= ${range.from.toISOString()} AND occurred_at < ${range.to.toISOString()} ${visitorFilter} GROUP BY day`,
      ),
      this.db.execute<{ day: string; count: number }>(
        sql`SELECT to_char(s.delivered_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day, count(*)::int AS count FROM shipments s JOIN orders o ON o.id = s.order_id AND o.organization_id = s.organization_id WHERE o.organization_id = ${org.id} AND s.shipment_status = 'delivered' AND s.delivered_at >= ${range.from.toISOString()} AND s.delivered_at < ${range.to.toISOString()} ${storeFilter} GROUP BY day`,
      ),
    ]);
    const series = [];
    for (
      let time = range.from.getTime();
      time < range.to.getTime();
      time += 86400000
    ) {
      const day = new Date(time).toISOString().slice(0, 10);
      series.push({
        day,
        visitors: visitorSeries.find((r) => r.day === day)?.count ?? 0,
        orders: orderSeries.find((r) => r.day === day)?.count ?? 0,
        deliveries: deliverySeries.find((r) => r.day === day)?.count ?? 0,
      });
    }
    return {
      range,
      visitors: visitorRows[0]?.count ?? 0,
      deliveredInRange: deliveryRows[0]?.count ?? 0,
      metrics: fold([...totals])[0] ?? empty(),
      byMarket: fold([...markets]),
      byProduct: fold([...productRows]),
      bySource: fold([...sources]),
      series,
    };
  }
}
