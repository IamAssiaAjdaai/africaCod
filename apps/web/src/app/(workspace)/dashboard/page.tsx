import { DomainError } from "@africacod/domain";
import { ZodError } from "zod";
import { DashboardOverview } from "@/components/dashboard-overview";
import { formatMoney } from "@africacod/shared/money";
import Link from "next/link";
import { ArrowRight, Plus, Store } from "lucide-react";
import { PageHeading } from "@africacod/ui";
import {
  commerce,
  operations,
  dashboard,
  requireOrganization,
} from "@/lib/server";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    storeId?: string;
  }>;
}) {
  const query = await searchParams;
  const { session } = await requireOrganization();
  const service = commerce();
  const stores = await service.listStores(session.user.id);
  const ops = operations();
  const [
    metrics,
    recent,
    confirmation,
    callbacks,
    ready,
    awaitingFulfillment,
    performance,
  ] = await Promise.all([
    ops.operationalMetrics(session.user.id),
    ops.listOperationalOrders(session.user.id),
    ops.listOperationalOrders(session.user.id, { status: "new" }),
    ops.listOperationalOrders(session.user.id, { callbacks: "due" }),
    ops.listOperationalOrders(session.user.id, {
      status: "confirmed",
      fulfillment: "ready",
    }),
    ops.listOperationalOrders(session.user.id, {
      status: "confirmed",
      fulfillment: "none",
    }),
    dashboard()
      .overview(session.user.id, {
        range: query.range ?? "7d",
        from: query.from || undefined,
        to: query.to || undefined,
        storeId: query.storeId || undefined,
      })
      .catch((error: unknown) => {
        if (
          error instanceof ZodError ||
          (error instanceof DomainError && error.code === "INVALID_INPUT")
        )
          return {
            error:
              error instanceof ZodError
                ? "Choose a valid date range and Store."
                : error.message,
          };
        throw error;
      }),
  ]);
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE AT A GLANCE"
        title={`Welcome, ${session.user.name.split(" ")[0]}.`}
        description="Today’s work across your stores: confirm orders, follow up and prepare fulfillment."
      />
      <form method="get" className="dashboard-range panel">
        <label>
          Date range
          <select name="range" defaultValue={query.range ?? "7d"}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          From (Custom)
          <input name="from" type="date" defaultValue={query.from} />
        </label>
        <label>
          To (Custom)
          <input name="to" type="date" defaultValue={query.to} />
        </label>
        <label>
          Store
          <select name="storeId" defaultValue={query.storeId ?? ""}>
            <option value="">All Stores</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-green">Apply range</button>
      </form>
      {"error" in performance ? (
        <p className="form-error" role="alert">
          {performance.error}
        </p>
      ) : (
        <DashboardOverview data={performance} />
      )}
      <h2>Operational queues · all time</h2>
      <nav className="catalog-filters">
        <Link className="button button-outline" href="/orders/confirmation">
          Confirmation queue
        </Link>
        <Link className="button button-outline" href="/orders/callbacks">
          Callbacks
        </Link>
        <Link className="button button-outline" href="/fulfillment">
          Fulfillment queue
        </Link>
      </nav>
      <section className="stats-grid">
        {[
          ["Orders", metrics.orders],
          ["New / awaiting confirmation", metrics.new],
          ["Confirmed", metrics.confirmed],
          ["Cancelled", metrics.cancelled],
          ["Callback Due", metrics.callbackDue],
          ["Upcoming callbacks", metrics.callbacksUpcoming],
          ["Ready for Fulfillment", metrics.ready],
          ["Shipped", metrics.shipped],
          ["Out for Delivery", metrics.outForDelivery],
          ["Delivered", metrics.delivered],
          ["Refused", metrics.refused],
          ["Returned", metrics.returned],
        ].map(([label, value]) => (
          <div
            className="stat-card"
            key={label}
            data-testid={`metric-${String(label).toLowerCase().replaceAll(" ", "-")}`}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <Link href="/analytics" className="button button-outline">
        View full Analytics
      </Link>
      <section className="panel" data-testid="delivered-revenue">
        <h2>Delivered Revenue</h2>
        {metrics.revenue.length ? (
          metrics.revenue.map((v) => (
            <p key={v.currency}>
              <strong>{formatMoney(BigInt(v.totalMinor), v.currency)}</strong>
            </p>
          ))
        ) : (
          <p>—</p>
        )}
        <p className="muted">
          Original order totals for delivered shipments, grouped by currency.
          Submitted COD value is not revenue.
        </p>
      </section>
      <div className="dashboard-work-grid">
        {[
          {
            title: "Recent Orders",
            href: "/orders",
            rows: recent.rows,
            empty: "Publish a product and start receiving COD orders.",
          },
          {
            title: "Confirmation Queue",
            href: "/orders/confirmation",
            rows: confirmation.rows,
            empty: "No orders awaiting confirmation.",
          },
          {
            title: "Callbacks Due",
            href: "/orders/callbacks?callbacks=due",
            rows: callbacks.rows,
            empty:
              "No callbacks due. Scheduled follow-ups appear here when due.",
          },
          {
            title: "Fulfillment Ready",
            href: "/fulfillment",
            rows: [...awaitingFulfillment.rows, ...ready.rows],
            empty: "Confirm an order to prepare its fulfillment.",
          },
        ].map((queue) => (
          <section className="panel" key={queue.title}>
            <div className="section-heading">
              <h2>{queue.title}</h2>
              <Link className="text-link" href={queue.href}>
                View queue →
              </Link>
            </div>
            {queue.rows.length ? (
              <ul className="work-list">
                {queue.rows.slice(0, 5).map(({ order }) => (
                  <li key={order.id}>
                    <Link href={`/orders/${order.id}`}>
                      <strong>{order.orderNumber}</strong>
                      <span>
                        {order.customerName} · {order.marketName}
                      </span>
                      <small>
                        {formatMoney(order.totalMinor, order.currency)}
                      </small>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{queue.empty}</p>
            )}
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Your stores</h2>
            <p className="muted">Every brand has its own journey.</p>
          </div>
          <Link className="text-link" href="/stores">
            View all <ArrowRight size={16} />
          </Link>
        </div>
        {stores.length ? (
          <div className="dashboard-store-list">
            {stores.slice(0, 4).map((store) => (
              <Link href={`/stores/${store.id}`} key={store.id}>
                <span className="store-avatar">
                  <Store size={20} />
                </span>
                <div>
                  <strong>{store.name}</strong>
                  <small>/{store.slug}</small>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Store size={27} />
            </span>
            <h3>Your first store starts here.</h3>
            <p>Create a home for your brand, then add your markets.</p>
            <Link className="button button-green" href="/stores/new">
              <Plus size={16} /> Create your first store
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
