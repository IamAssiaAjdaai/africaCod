import Link from "next/link";
import { TableScroll } from "@africacod/ui";
import { Users, ShoppingBag, Timer, PackageCheck } from "lucide-react";
import type { DashboardService, DashboardGroup } from "@africacod/domain";
import { formatMoney } from "@africacod/shared/money";
type Overview = Awaited<ReturnType<DashboardService["overview"]>>;
function revenue(values: Record<string, string>) {
  return (
    Object.entries(values)
      .map(([currency, total]) => formatMoney(BigInt(total), currency))
      .join(" · ") || "—"
  );
}
function Performance({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: DashboardGroup[];
  empty: string;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {rows.length ? (
        <TableScroll label={`${title} data table`}>
          <table className="markets-table">
            <thead>
              <tr>
                <th>{title.replace("Performance by ", "")}</th>
                <th>Orders</th>
                <th>Confirmed</th>
                <th>Delivered</th>
                <th>Delivery Rate</th>
                <th>Delivered Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.orders}</td>
                  <td>{row.confirmed}</td>
                  <td>{row.delivered}</td>
                  <td>
                    {row.orders
                      ? `${((row.delivered / row.orders) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td>{revenue(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}
export function DashboardOverview({ data }: { data: Overview }) {
  const max = Math.max(
    1,
    ...data.series.flatMap((d) => [d.visitors, d.orders, d.deliveries]),
  );
  const points = (key: "visitors" | "orders" | "deliveries") =>
    data.series
      .map(
        (d, i) =>
          `${30 + (i / Math.max(1, data.series.length - 1)) * 940},${230 - (d[key] / max) * 200}`,
      )
      .join(" ");
  const funnel = [
    ["Visitors", data.visitors],
    ["Orders", data.metrics.orders],
    ["Confirmed", data.metrics.confirmed],
    ["Shipped", data.metrics.shipped],
    ["Delivered", data.metrics.delivered],
  ] as const;
  return (
    <div className="operational-overview">
      <section className="stats-grid" aria-label="Period metrics">
        {[
          {
            label: "Visitors",
            value: data.visitors,
            help: "Consented Store and Product page observations; not unique people.",
            Icon: Users,
          },
          {
            label: "Total Orders",
            value: data.metrics.orders,
            help: "Orders created in the selected UTC date range.",
            Icon: ShoppingBag,
          },
          {
            label: "Processing",
            value: data.metrics.processing,
            help: "Orders created in range, new/confirmed with no shipment or created/shipped/out for delivery.",
            Icon: Timer,
          },
          {
            label: "Delivered",
            value: data.deliveredInRange,
            help: "Currently delivered shipments whose delivery timestamp falls in range.",
            Icon: PackageCheck,
          },
        ].map(({ label, value, help, Icon }) => (
          <div className="stat-card period-stat" key={label}>
            <span>
              {label}
              <Icon size={20} />
            </span>
            <strong>{value}</strong>
            <small>{help}</small>
          </div>
        ))}
      </section>
      <div className="overview-panels">
        <section className="panel">
          <h2>Orders Overview</h2>
          <p className="muted">
            {data.range.from.toISOString().slice(0, 10)} —{" "}
            {new Date(data.range.to.getTime() - 86400000)
              .toISOString()
              .slice(0, 10)}{" "}
            · UTC · visitor observations retained for 30 days
          </p>
          <div className="chart-legend">
            <span className="chart-visitors">Visitors</span>
            <span className="chart-orders">Orders</span>
            <span className="chart-deliveries">Deliveries</span>
          </div>
          <svg
            viewBox="0 0 1000 260"
            className="overview-chart"
            role="img"
            aria-label="Daily visitor, order and delivery counts. Exact values are in the table below."
          >
            <line
              x1="30"
              y1="230"
              x2="970"
              y2="230"
              stroke="var(--border-strong)"
            />
            <text x="2" y="35">
              {max}
            </text>
            <text x="5" y="230">
              0
            </text>
            {(
              [
                ["visitors", "var(--chart-visitors)"],
                ["orders", "var(--chart-orders)"],
                ["deliveries", "var(--chart-deliveries)"],
              ] as const
            ).map(([key, color]) => (
              <g key={key}>
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  points={points(key)}
                />
                {data.series.length === 1 && (
                  <circle
                    cx="30"
                    cy={230 - (data.series[0][key] / max) * 200}
                    r="4"
                    fill={color}
                  />
                )}
              </g>
            ))}
          </svg>
          {!data.series.some((d) => d.visitors || d.orders || d.deliveries) && (
            <p className="muted">No visitor or Order data for this period.</p>
          )}
          <details>
            <summary>View daily counts</summary>
            <TableScroll label="Daily counts data table">
              <table className="markets-table">
                <thead>
                  <tr>
                    <th>Date (UTC)</th>
                    <th>Visitors</th>
                    <th>Orders</th>
                    <th>Deliveries</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series.map((d) => (
                    <tr key={d.day}>
                      <th>{d.day}</th>
                      <td>{d.visitors}</td>
                      <td>{d.orders}</td>
                      <td>{d.deliveries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </details>
        </section>
        <section className="panel">
          <h2>COD Performance Funnel</h2>
          <p className="muted">
            Order creation cohort in this range, with current shipment outcomes.
            Visitor conversion is directional: observations are not unique
            customers.
          </p>
          <ol className="cod-funnel">
            {funnel.map(([label, count], i) => (
              <li key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
                <small>
                  {i && funnel[i - 1][1]
                    ? `${((count / funnel[i - 1][1]) * 100).toFixed(1)}% of ${funnel[i - 1][0].toLowerCase()}`
                    : "—"}
                </small>
              </li>
            ))}
          </ol>
          <p>
            Refused: <strong>{data.metrics.refused}</strong> · Returned:{" "}
            <strong>{data.metrics.returned}</strong>
          </p>
          <p>
            Delivered Revenue: <strong>{revenue(data.metrics.revenue)}</strong>
          </p>
          <p className="muted">
            Historical order totals grouped by currency. Submitted COD value is
            not Delivered Revenue; returns and refusals are excluded.
          </p>
        </section>
      </div>
      <Performance
        title="Performance by Product"
        rows={data.byProduct}
        empty="No Product data for this period."
      />
      <Performance
        title="Orders by Ad Platform"
        rows={data.bySource}
        empty="No source data for this period."
      />
      <p className="muted">
        Attribution without consent or usable source data is Unknown. Direct is
        shown only when captured attribution supports it.
      </p>
      <Performance
        title="Performance by Market"
        rows={data.byMarket}
        empty="No Market performance yet."
      />
      {!data.metrics.orders && (
        <section className="panel">
          <h2>No Orders yet</h2>
          <p className="muted">
            Add your markets, publish a product and prepare your Store.
          </p>
          <div className="form-actions">
            <Link className="button button-green" href="/products/new">
              Create Product
            </Link>
            <Link className="button button-outline" href="/stores">
              Add Market / Publish Store
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
