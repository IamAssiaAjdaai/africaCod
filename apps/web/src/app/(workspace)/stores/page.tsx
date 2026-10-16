import Link from "next/link";
import { Globe2, Plus, Store } from "lucide-react";
import { StatusBadge, PageHeading, EmptyState } from "@africacod/ui";
import { NavigationFeedback } from "@/components/navigation-feedback";
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
    <div className="stores-page">
      <PageHeading
        eyebrow="Organization storefronts"
        title="Stores"
        description="Each store has its own storefront, catalog and delivery markets."
        action={
          <Link className="button button-green" href="/stores/new">
            <Plus size={17} aria-hidden="true" /> Create store
          </Link>
        }
      />
      <div className="section-meta">
        <span>
          {stores.length} {stores.length === 1 ? "store" : "stores"}
        </span>
        <span>Store status and storefront publication are separate.</span>
      </div>
      {rows.length ? (
        <section className="store-grid" aria-label="Your stores">
          {rows.map((store) => (
            <article
              className="store-card"
              key={store.id}
              aria-labelledby={`store-${store.id}`}
            >
              <div className="store-card-top">
                <span className="store-avatar" aria-hidden="true">
                  <Store size={24} />
                </span>
                <StatusBadge status={store.status}>
                  {store.status === "active"
                    ? "Active store"
                    : "Inactive store"}
                </StatusBadge>
              </div>
              <h2 id={`store-${store.id}`}>
                <Link href={`/stores/${store.id}`}>{store.name}</Link>
              </h2>
              <div className="store-card-facts">
                <span>
                  <Globe2 size={16} aria-hidden="true" />
                  {
                    store.markets.filter((m) => m.status === "active").length
                  }{" "}
                  active · {store.markets.length} total markets
                </span>
                <StatusBadge
                  status={store.settingsPublishedAt ? "published" : "draft"}
                >
                  {store.settingsPublishedAt
                    ? "Published storefront"
                    : "Draft storefront"}
                </StatusBadge>
              </div>
              <div className="store-card-actions">
                <Link
                  className="button button-outline"
                  href={`/stores/${store.id}`}
                  aria-label={`Manage ${store.name}`}
                >
                  Manage store <NavigationFeedback />
                </Link>
                <Link
                  className="text-link"
                  href={`/stores/${store.id}/settings`}
                  aria-label={`Settings for ${store.name}`}
                >
                  Settings <NavigationFeedback />
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel empty-stores">
          <EmptyState
            icon={<Store size={28} />}
            title="No stores yet."
            description="Create a home for your brand, then choose the markets where you want to sell."
            action={
              <Link className="button button-green" href="/stores/new">
                <Plus size={17} aria-hidden="true" /> Create your first store
              </Link>
            }
          />
          <p className="empty-stores-footer">
            <Globe2 size={16} aria-hidden="true" /> A store can reach many
            markets. You choose which ones.
          </p>
        </section>
      )}
    </div>
  );
}
