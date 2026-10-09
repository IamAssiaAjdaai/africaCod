import { redirect } from "next/navigation";
import { StoreSetup } from "@/components/store-setup";
import { DomainError } from "@africacod/domain";
import { ZodError } from "zod";
import { DashboardOverview } from "@/components/dashboard-overview";
import { DashboardDisclosure } from "@/components/dashboard-disclosure";
import { formatMoney } from "@africacod/shared/money";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  ChevronDown,
  PhoneCall,
  Plus,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";
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
  if (!stores.length) redirect("/stores/new");
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
    ops.listOperationalOrders(session.user.id, {}, 5),
    ops.listOperationalOrders(session.user.id, { status: "new" }, 5),
    ops.listOperationalOrders(session.user.id, { callbacks: "due" }, 5),
    ops.listOperationalOrders(
      session.user.id,
      {
        status: "confirmed",
        fulfillment: "ready",
      },
      5,
    ),
    ops.listOperationalOrders(
      session.user.id,
      {
        status: "confirmed",
        fulfillment: "none",
      },
      5,
    ),
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
    <div className="dashboard-page">
      <PageHeading
        eyebrow="Organization workspace"
        title="Dashboard"
        description="Confirm orders, follow up with customers and keep fulfillment moving."
        secondaryAction={
          <Link href="/products/new" className="button button-outline">
            <Plus size={16} aria-hidden="true" /> Create Product
          </Link>
        }
        action={
          metrics.new > 0 ? (
            <Link href="/orders/confirmation" className="button button-green">
              Review orders <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : undefined
        }
      />
      <div className="section-heading dashboard-section-heading">
        <div>
          <h2>Order operations</h2>
          <p className="muted">
            All stores in your organization · all time. Performance filters
            below do not affect these queues.
          </p>
        </div>
      </div>
      <nav
        className="dashboard-quick-actions"
        aria-label="Dashboard quick actions"
      >
        {[
          {
            label: "Confirmation queue",
            description: "Awaiting confirmation · all time",
            count: metrics.new,
            metric: "new-/-awaiting-confirmation",
            href: "/orders/confirmation",
            Icon: ClipboardCheck,
          },
          {
            label: "Callbacks",
            description: "Due for follow-up · all time",
            count: metrics.callbackDue,
            metric: "callback-due",
            href: "/orders/callbacks",
            Icon: PhoneCall,
          },
          {
            label: "Fulfillment queue",
            description: "Ready to fulfill · all time",
            count: metrics.ready,
            metric: "ready-for-fulfillment",
            href: "/fulfillment",
            Icon: Truck,
          },
        ].map(({ label, description, count, metric, href, Icon }) => (
          <Link key={href} href={href}>
            <span className="quick-action-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <span className="quick-action-copy">
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <span
              className="quick-action-count"
              data-testid={`metric-${metric}`}
            >
              <strong>{count}</strong>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <div className="dashboard-operation-details">
        <DashboardDisclosure
          title="Order previews"
          description="Confirmation, callbacks, fulfillment and recent orders"
          className="dashboard-order-previews"
        >
          <div className="dashboard-work-grid">
            {[
              {
                title: "Confirmation Queue",
                Icon: ClipboardCheck,
                href: "/orders/confirmation",
                rows: confirmation.rows,
                empty: "New orders appear here for customer confirmation.",
              },
              {
                title: "Callbacks Due",
                Icon: PhoneCall,
                href: "/orders/callbacks?callbacks=due",
                rows: callbacks.rows,
                empty: "Scheduled customer follow-ups appear here when due.",
              },
              {
                title: "Fulfillment Ready",
                Icon: Truck,
                href: "/fulfillment",
                rows: [...awaitingFulfillment.rows, ...ready.rows],
                empty:
                  "Confirmed orders appear here to prepare and manage fulfillment.",
              },
              {
                title: "Recent Orders",
                Icon: ShoppingBag,
                href: "/orders",
                rows: recent.rows,
                empty:
                  "Your latest orders appear here as customers place them.",
              },
            ].map((queue) => (
              <section key={queue.title} className="dashboard-queue">
                <div className="section-heading">
                  <h2>{queue.title}</h2>
                  <Link
                    className="text-link"
                    href={queue.href}
                    aria-label={`View ${queue.title.toLowerCase()}`}
                  >
                    View queue <ArrowRight size={16} aria-hidden="true" />
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
                  <div className="queue-empty">
                    <queue.Icon size={22} aria-hidden="true" />
                    <p className="muted">{queue.empty}</p>
                  </div>
                )}
              </section>
            ))}
          </div>
        </DashboardDisclosure>
        <DashboardDisclosure
          title="All-time operations"
          description="All stores · status and revenue"
          className="dashboard-operations"
        >
          <section
            className="stats-grid queue-metrics"
            aria-label="All-time operational counts"
          >
            {[
              ["Orders", metrics.orders],
              ["Confirmed", metrics.confirmed],
              ["Cancelled", metrics.cancelled],
              ["Upcoming callbacks", metrics.callbacksUpcoming],
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
          <p className="muted dashboard-queue-note">
            Awaiting confirmation, due callbacks and ready-for-fulfillment
            counts are in the queue shortcuts above. All operational counts are
            all time.
          </p>
          <section
            className="panel operational-revenue"
            data-testid="delivered-revenue"
          >
            <div className="section-heading">
              <h2>Delivered Revenue</h2>
              <span className="dashboard-scope">All time</span>
            </div>
            {metrics.revenue.length ? (
              metrics.revenue.map((v) => (
                <p key={v.currency}>
                  <strong>
                    {formatMoney(BigInt(v.totalMinor), v.currency)}
                  </strong>
                </p>
              ))
            ) : (
              <p>—</p>
            )}
            <p className="muted">
              Original order totals for delivered shipments, grouped by
              currency. Submitted COD value is not revenue.
            </p>
          </section>
        </DashboardDisclosure>
      </div>
      {stores
        .filter((store) => !store.settingsPublishedAt)
        .map((store) => (
          <DashboardDisclosure
            key={store.id}
            title={`Finish setting up ${store.name}`}
            description="Draft storefront · setup checklist"
            className="dashboard-store-setup"
          >
            <StoreSetup store={store} userId={session.user.id} />
          </DashboardDisclosure>
        ))}
      <div className="section-heading dashboard-section-heading">
        <div>
          <h2>Period performance</h2>
          <p className="muted">
            Filter your store activity by date. All dates use UTC.
          </p>
        </div>
        <Link href="/analytics" className="text-link">
          View full Analytics <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <form
        method="get"
        className="dashboard-range panel"
        aria-label="Dashboard date and store filters"
      >
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
        <details
          className="dashboard-custom-dates"
          open={query.range === "custom"}
        >
          <summary>
            Custom dates <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div>
            <label>
              From (Custom)
              <input name="from" type="date" defaultValue={query.from} />
            </label>
            <label>
              To (Custom)
              <input name="to" type="date" defaultValue={query.to} />
            </label>
          </div>
          <p className="muted">
            Choose Custom in Date range to apply these UTC dates.
          </p>
        </details>
        <button className="button button-green">Apply range</button>
      </form>
      {"error" in performance ? (
        <p className="form-error" role="alert">
          {performance.error}
        </p>
      ) : (
        <DashboardOverview
          data={performance}
          hasOrderHistory={metrics.orders > 0}
        />
      )}
      <section className="panel dashboard-stores">
        <div className="section-heading">
          <div>
            <h2>Your stores</h2>
            <p className="muted">
              Stores belong to your organization. Each has its own storefront
              and markets.
            </p>
          </div>
          <Link className="text-link" href="/stores">
            View all <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {stores.length ? (
          <div className="dashboard-store-list">
            {stores.slice(0, 4).map((store) => (
              <div className="dashboard-store-card" key={store.id}>
                <Link href={`/stores/${store.id}`}>
                  <span className="store-avatar">
                    <Store size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{store.name}</strong>
                    <small>
                      {store.status === "active" ? "Active" : "Inactive"} ·{" "}
                      {store.settingsPublishedAt
                        ? "Published storefront"
                        : "Draft storefront"}
                    </small>
                  </div>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <details className="dashboard-store-details">
                  <summary>
                    Store details <ChevronDown size={14} aria-hidden="true" />
                  </summary>
                  <dl>
                    <div>
                      <dt>Store address</dt>
                      <dd>/s/{store.slug}</dd>
                    </div>
                    <div>
                      <dt>Store ID</dt>
                      <dd>{store.id}</dd>
                    </div>
                  </dl>
                </details>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Store size={27} aria-hidden="true" />
            </span>
            <h3>Your first store starts here.</h3>
            <p>Create a home for your brand, then add your markets.</p>
            <Link className="button button-green" href="/stores/new">
              <Plus size={16} aria-hidden="true" /> Create your first store
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
