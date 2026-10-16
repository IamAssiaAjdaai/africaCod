import { TableScroll } from "@africacod/ui";
import {
  ChartNoAxesCombined,
  ChevronDown,
  Users,
  ShoppingBag,
  Timer,
  PackageCheck,
} from "lucide-react";
import type { DashboardService, DashboardGroup } from "@africacod/domain";
import { formatMoney } from "@africacod/shared/money";
import { DashboardChart } from "./dashboard-chart";
import { DashboardDisclosure } from "./dashboard-disclosure";
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
  note,
}: {
  title: string;
  rows: DashboardGroup[];
  empty: string;
  note?: string;
}) {
  return (
    <DashboardDisclosure
      title={title}
      description="Order counts and delivered revenue"
      className="dashboard-performance"
    >
      <h2>{title}</h2>
      {rows.length ? (
        <TableScroll label={`${title} data table`}>
          <table className="markets-table">
            <thead>
              <tr>
                <th scope="col">{title.replace("Performance by ", "")}</th>
                <th scope="col">Orders</th>
                <th scope="col">Confirmed</th>
                <th scope="col">Delivered</th>
                <th scope="col">Delivery Rate</th>
                <th scope="col">Delivered Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.name}</th>
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
        <div className="performance-empty">
          <ChartNoAxesCombined size={20} aria-hidden="true" />
          <p className="muted">{empty}</p>
        </div>
      )}
      {note && <p className="muted dashboard-attribution-note">{note}</p>}
    </DashboardDisclosure>
  );
}
export function DashboardOverview({
  data,
  hasOrderHistory,
}: {
  data: Overview;
  hasOrderHistory: boolean;
}) {
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
            label: "Total Orders",
            value: data.metrics.orders,
            help: "Orders created in the selected UTC date range.",
            context: "Created in range",
            Icon: ShoppingBag,
          },
          {
            label: "Processing",
            value: data.metrics.processing,
            help: "Orders created in range, new/confirmed with no shipment or created/shipped/out for delivery.",
            context: "Created in range",
            Icon: Timer,
          },
          {
            label: "Delivered",
            value: data.deliveredInRange,
            help: "Currently delivered shipments whose delivery timestamp falls in range.",
            context: "Delivery date in range",
            Icon: PackageCheck,
          },
          {
            label: "Visitors",
            value: data.visitors,
            help: "Consented Store and Product page observations; not unique people.",
            context: "Page observations",
            Icon: Users,
          },
        ].map(({ label, value, help, context, Icon }) => (
          <div className="stat-card period-stat" key={label} title={help}>
            <span>
              {label}
              <Icon size={20} aria-hidden="true" />
            </span>
            <strong>{value}</strong>
            <small>{context}</small>
          </div>
        ))}
      </section>
      <details className="dashboard-metric-definitions dashboard-daily-counts">
        <summary>
          About these metrics <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <dl>
          <div>
            <dt>Total Orders</dt>
            <dd>Orders created in the selected UTC date range.</dd>
          </div>
          <div>
            <dt>Processing</dt>
            <dd>
              Orders created in range, new/confirmed with no shipment or
              created/shipped/out for delivery.
            </dd>
          </div>
          <div>
            <dt>Delivered</dt>
            <dd>
              Currently delivered shipments whose delivery timestamp falls in
              range.
            </dd>
          </div>
          <div>
            <dt>Visitors</dt>
            <dd>
              Consented Store and Product page observations; not unique people.
            </dd>
          </div>
        </dl>
      </details>
      <section className="panel dashboard-chart-panel">
        <h2>Orders Overview</h2>
        <p className="muted">
          {data.range.from.toISOString().slice(0, 10)} —{" "}
          {new Date(data.range.to.getTime() - 86400000)
            .toISOString()
            .slice(0, 10)}{" "}
          · UTC · visitor observations retained for 30 days
        </p>
        {!data.metrics.orders && (
          <div className="dashboard-period-empty">
            <h3>
              {hasOrderHistory
                ? "No orders in this period"
                : "Ready for your first order"}
            </h3>
            <p className="muted">
              {hasOrderHistory
                ? "Try another date range or store to explore your activity. The operational queues above cover all stores and dates."
                : "Create a product and finish your store setup to start receiving COD orders. Use the queues above for confirmation, callbacks and fulfillment."}
            </p>
          </div>
        )}
        <DashboardChart series={data.series} />
        <details className="dashboard-daily-counts">
          <summary>
            View daily counts <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <TableScroll label="Daily counts data table">
            <table className="markets-table">
              <thead>
                <tr>
                  <th scope="col">Date (UTC)</th>
                  <th scope="col">Visitors</th>
                  <th scope="col">Orders</th>
                  <th scope="col">Deliveries</th>
                </tr>
              </thead>
              <tbody>
                {data.series.map((d) => (
                  <tr key={d.day}>
                    <th scope="row">{d.day}</th>
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
      <DashboardDisclosure
        title="COD Performance Funnel"
        description="Conversion and order cohort revenue"
        className="dashboard-funnel-panel"
      >
        <h2>COD Performance Funnel</h2>
        <p className="muted">
          Order creation cohort in this range, with current shipment outcomes.
          Visitor conversion is directional: observations are not unique
          customers.
        </p>
        <ol className="cod-funnel">
          {funnel.map(([label, count], i) => (
            <li key={label}>
              <span className="funnel-step" aria-hidden="true">
                {i + 1}
              </span>
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
        <p className="funnel-outcomes">
          Refused: <strong>{data.metrics.refused}</strong> · Returned:{" "}
          <strong>{data.metrics.returned}</strong>
        </p>
        <p className="funnel-revenue">
          Delivered Revenue: <strong>{revenue(data.metrics.revenue)}</strong>
        </p>
        <p className="muted">
          Historical order totals grouped by currency. Submitted COD value is
          not Delivered Revenue; returns and refusals are excluded.
        </p>
      </DashboardDisclosure>
      <Performance
        title="Performance by Product"
        rows={data.byProduct}
        empty="Products with orders in this range appear here."
      />
      <Performance
        title="Orders by Ad Platform"
        rows={data.bySource}
        empty="Acquisition sources for orders in this range appear here."
        note="Attribution without consent or usable source data is Unknown. Direct is shown only when captured attribution supports it."
      />
      <Performance
        title="Performance by Market"
        rows={data.byMarket}
        empty="Markets with orders in this range appear here."
      />
    </div>
  );
}
