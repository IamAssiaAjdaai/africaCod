import { formatMoney } from "@africacod/shared/money";
import Link from "next/link";
import { ArrowRight, Globe2, Plus, Store, Package } from "lucide-react";
import { PageHeading } from "@africacod/ui";
import {
  commerce,
  catalog,
  operations,
  requireOrganization,
} from "@/lib/server";
export default async function Dashboard() {
  const { session } = await requireOrganization();
  const service = commerce();
  const stores = await service.listStores(session.user.id);
  const markets = (
    await Promise.all(
      stores.map((store) => service.listMarkets(session.user.id, store.id)),
    )
  ).flat();
  const data = await catalog().productListData(session.user.id);
  const activeOffers = data.offers.filter(
    (offer) =>
      offer.status === "active" &&
      data.markets.some(
        (market) =>
          market.id === offer.storeMarketId && market.status === "active",
      ),
  );
  const metrics = await operations().operationalMetrics(session.user.id);
  const active = markets.filter((m) => m.status === "active");
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE AT A GLANCE"
        title={`Welcome, ${session.user.name.split(" ")[0]}.`}
        description="A little perspective for your next big move."
      />
      <section className="dashboard-banner">
        <div>
          <span className="eyebrow">BUILT FOR YOUR AMBITION</span>
          <h2>
            Local roots.
            <br />
            <em>Room to grow.</em>
          </h2>
          <p>Bring your stores together. Choose where you go next.</p>
          <Link className="button button-lime" href="/stores/new">
            Create a store <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div />
          <Globe2 size={175} strokeWidth={0.65} />
          <span>THE NEXT CHAPTER IS YOURS</span>
        </div>
      </section>
      <section className="stats-grid">
        <div className="stat-card">
          <span>
            Your stores
            <Store size={18} />
          </span>
          <strong>{stores.length.toString().padStart(2, "0")}</strong>
          <small>Brands in your organization</small>
        </div>
        <div className="stat-card">
          <span>
            Active markets
            <Globe2 size={18} />
          </span>
          <strong>{active.length.toString().padStart(2, "0")}</strong>
          <small>Countries you’ve chosen to reach</small>
        </div>
        <div className="stat-card">
          <span>
            Products
            <Package size={18} />
          </span>
          <strong>{data.products.length.toString().padStart(2, "0")}</strong>
          <small>Products across your stores</small>
        </div>
        <div className="stat-card">
          <span>
            Active offers
            <Globe2 size={18} />
          </span>
          <strong>{activeOffers.length.toString().padStart(2, "0")}</strong>
          <small>Active offers in active store markets</small>
        </div>
      </section>
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
