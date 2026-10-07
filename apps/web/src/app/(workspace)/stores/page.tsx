import Link from "next/link";
import { ArrowUpRight, Globe2, Plus, Store } from "lucide-react";
import { StatusBadge, PageHeading } from "@africacod/ui";
import { commerce, requireOrganization } from "@/lib/server";
export default async function StoresPage() {
  const { session } = await requireOrganization();
  const service = commerce();
  const stores = await service.listStores(session.user.id);
  const rows = await Promise.all(
    stores.map(async (store) => ({
      ...store,
      markets: await service.listMarkets(session.user.id, store.id),
    })),
  );
  return (
    <>
      <PageHeading
        eyebrow="STOREFRONT"
        title="Stores"
        description="Manage storefronts and markets."
        action={
          <Link className="button button-green" href="/stores/new">
            <Plus size={17} /> Create store
          </Link>
        }
      />
      <div className="section-meta">
        <span>
          {stores.length} {stores.length === 1 ? "store" : "stores"}
        </span>
        <span>Markets are configured per store.</span>
      </div>
      {rows.length ? (
        <section className="store-grid">
          {rows.map((store) => (
            <Link
              className="store-card"
              href={`/stores/${store.id}`}
              key={store.id}
            >
              <div className="store-card-top">
                <span className="store-avatar">
                  <Store size={25} />
                </span>
                <StatusBadge status={store.status}>
                  {store.status === "active" ? "Active" : "Inactive"}
                </StatusBadge>
              </div>
              <h2>{store.name}</h2>
              <p>/s/{store.slug}</p>
              <div className="store-card-bottom">
                <span>
                  <Globe2 size={16} />
                  {
                    store.markets.filter((m) => m.status === "active").length
                  }{" "}
                  active markets
                </span>
                <ArrowUpRight size={20} />
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="panel empty-stores">
          <div className="empty-state">
            <span className="empty-icon">
              <Store size={30} />
            </span>
            <p className="eyebrow">STOREFRONT</p>
            <h2>No stores yet.</h2>
            <p>
              Your stores will live here. Create your first one,
              <br />
              then choose the markets where you want to sell.
            </p>
            <Link className="button button-green" href="/stores/new">
              <Plus size={17} /> Create your first store
            </Link>
          </div>
          <div className="empty-stores-footer">
            <Globe2 size={16} /> A store can reach many markets. You choose
            which ones.
          </div>
        </section>
      )}
    </>
  );
}
