import Link from "next/link";
import { ZodError } from "zod";
import { DomainError } from "@africacod/domain";
import { PageHeading } from "@africacod/ui";
import { type AnalyticsMetrics } from "@africacod/domain";
import { formatMoney } from "@africacod/shared/money";
import { analytics, requireOrganization } from "@/lib/server";
const money = (v: Record<string, number>) =>
  Object.entries(v)
    .map(([c, n]) => formatMoney(n, c))
    .join(" · ") || "No value";
function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; name: string; metrics: AnalyticsMetrics }[];
}) {
  return (
    <section className="panel" data-testid={`analytics-${title.toLowerCase()}`}>
      <h2>{title}</h2>
      <div className="table-scroll">
        <table className="markets-table analytics-table">
          <thead>
            <tr>
              {[
                "Name",
                "Orders",
                "Confirmed",
                "Shipped",
                "Delivered",
                "Refused",
                "Returned",
                "Delivery Rate",
                "Submitted Value",
                "Delivered Revenue",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.metrics.orders}</td>
                <td>{r.metrics.confirmed}</td>
                <td>{r.metrics.shipped}</td>
                <td>{r.metrics.delivered}</td>
                <td>{r.metrics.refused}</td>
                <td>{r.metrics.returned}</td>
                <td>{(r.metrics.deliveryRate * 100).toFixed(1)}%</td>
                <td>{money(r.metrics.submitted)}</td>
                <td>{money(r.metrics.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="empty-inline">
          No orders in this breakdown. Choose another date range or filter.
        </p>
      )}
    </section>
  );
}
export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireOrganization(),
    query = await searchParams,
    filter = Object.fromEntries(
      Object.entries(query).filter(([, v]) => typeof v === "string" && v),
    );
  let result;
  try {
    result = await analytics().analytics(session.user.id, filter);
  } catch (error) {
    if (!(error instanceof ZodError) && !(error instanceof DomainError))
      throw error;
    return (
      <>
        <PageHeading
          title="Analytics"
          description="Choose a valid date range and authorized filters."
        />
        <p role="alert" className="form-error">
          The date range or filters could not be used.
        </p>
        <Link className="button button-outline" href="/analytics">
          Reset filters
        </Link>
      </>
    );
  }
  const options = await analytics().options(session.user.id),
    m = result.metrics;
  return (
    <>
      <PageHeading
        eyebrow="OPERATIONS"
        title="Analytics"
        description="COD lifecycle truth from our database. Only delivered shipments generate delivered revenue."
      />
      <form className="panel stack-form analytics-filters" method="get">
        <label>
          Date range
          <select name="range" defaultValue={String(filter.range ?? "7d")}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          From (UTC)
          <input
            type="date"
            name="from"
            defaultValue={String(filter.from ?? "")}
          />
        </label>
        <label>
          Through (UTC)
          <input type="date" name="to" defaultValue={String(filter.to ?? "")} />
        </label>
        {(["stores", "markets", "products"] as const).map((key, i) => (
          <label key={key}>
            {["Store", "Market", "Product"][i]}
            <select
              name={["storeId", "marketId", "productId"][i]}
              defaultValue={String(
                filter[["storeId", "marketId", "productId"][i]] ?? "",
              )}
            >
              <option value="">All</option>
              {options[key].map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button className="button button-green">Apply filters</button>
      </form>
      <p className="muted">
        UTC order-created cohort: {result.range.from.toISOString().slice(0, 10)}{" "}
        through{" "}
        {new Date(result.range.to.getTime() - 1).toISOString().slice(0, 10)}.
        Outcomes reflect current lifecycle state.
      </p>
      {!m.orders && (
        <section className="panel empty-state">
          <h2>No orders in this period</h2>
          <p>
            Publish a product and receive COD orders, or choose a different
            range. Metrics below reflect actual data.
          </p>
          <Link href="/products" className="button button-outline">
            Manage Products
          </Link>
        </section>
      )}
      <section className="panel" data-testid="analytics-metrics">
        <h2>Lifecycle</h2>
        <dl className="stats-grid">
          {Object.entries({
            Orders: m.orders,
            Confirmed: m.confirmed,
            Shipped: m.shipped,
            Delivered: m.delivered,
            Refused: m.refused,
            Returned: m.returned,
            "Confirmation Rate": `${(m.confirmationRate * 100).toFixed(1)}%`,
            "Delivery Rate": `${(m.deliveryRate * 100).toFixed(1)}%`,
            "Submitted Order Value": money(m.submitted),
            "Delivered Revenue": money(m.revenue),
          }).map(([k, v]) => (
            <div className="stat-card" key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="panel">
        <h2>Operational funnel</h2>
        <ol className="funnel-steps">
          {[
            ["Created", m.orders, null],
            ["Confirmed", m.confirmed, m.orders],
            ["Shipped", m.shipped, m.confirmed],
            ["Delivered", m.delivered, m.shipped],
          ].map(([label, count, previous]) => (
            <li key={String(label)}>
              <span>{label}</span>
              <strong>{count}</strong>
              <small>
                {previous === null
                  ? "Order creation cohort"
                  : `${previous ? ((Number(count) / Number(previous)) * 100).toFixed(1) : "0.0"}% of previous step`}
              </small>
            </li>
          ))}
        </ol>
        <p>
          Refused {m.refused} · Returned {m.returned}
        </p>
      </section>
      <Breakdown title="Markets" rows={result.byMarket} />
      <Breakdown title="Stores" rows={result.byStore} />
      <Breakdown title="Products" rows={result.byProduct} />
      <section className="panel">
        <h2>Definitions</h2>
        <p>
          Orders count all submitted orders in the selected creation cohort.
          Confirmed counts orders with a confirmation timestamp. Shipped counts
          shipments that reached shipped, including later outcomes. Delivered,
          Refused and Returned count current shipment states. Both headline
          rates divide by all cohort orders; zero orders yields 0%.
        </p>
        <p>
          Submitted value includes all original order totals, including
          cancelled and returned orders. Delivered revenue includes original
          totals only where the current shipment is delivered. Values remain
          separate by currency. Product breakdown values use immutable item
          totals and exclude shipping fees; orders containing multiple products
          can appear in multiple product groups. Funnel percentages use the
          preceding step. No visitor conversion or profit is inferred.
        </p>
      </section>
    </>
  );
}
