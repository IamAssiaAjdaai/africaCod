import { StoreSetup } from "@/components/store-setup";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, CalendarDays, Link2, Store } from "lucide-react";
import { StatusBadge, PageHeading } from "@africacod/ui";
import { DomainError } from "@africacod/domain";
import { commerce, requireOrganization } from "@/lib/server";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { Markets } from "@/components/markets";
export default async function StoreDetail({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  if (!z.uuid().safeParse(storeId).success) notFound();
  const { session, organization } = await requireOrganization();
  const service = commerce();
  const store = await service
    .getStore(session.user.id, storeId)
    .catch((error: unknown) => {
      if (error instanceof DomainError && error.code === "NOT_FOUND")
        notFound();
      throw error;
    });
  const [markets, countries] = await Promise.all([
    service.listMarkets(session.user.id, store.id),
    service.listMerchantCountries(session.user.id),
  ]);
  return (
    <div className="store-detail-page">
      <Link className="back-link" href="/stores">
        <ArrowLeft size={16} aria-hidden="true" /> All stores
      </Link>
      <PageHeading
        eyebrow="Store management"
        title={store.name}
        description="Manage this store’s catalog, delivery markets and customer-facing storefront."
        secondaryAction={
          <StatusBadge status={store.status}>
            {store.status === "active" ? "Active store" : "Inactive store"}
          </StatusBadge>
        }
        action={
          <Link
            className="button button-green"
            href={`/stores/${store.id}/settings`}
          >
            Store Settings <NavigationFeedback />
          </Link>
        }
      />
      <nav className="section-nav" aria-label="Store sections">
        <a href="#store-overview">Overview</a>
        <a href="#store-catalog">Catalog</a>
        <a href="#store-markets">Markets</a>
        <Link href={`/stores/${store.id}/settings`}>Store Settings</Link>
        <a href="#storefront">Storefront</a>
        <a href="#store-apps">Apps</a>
      </nav>
      <section id="store-overview" className="panel store-info">
        <div className="section-heading">
          <div className="store-identity">
            <span className="store-avatar" aria-hidden="true">
              <Store size={24} />
            </span>
            <div>
              <h2>Store information</h2>
              <p className="muted">A storefront within your organization.</p>
            </div>
          </div>
          <StatusBadge
            status={store.settingsPublishedAt ? "published" : "draft"}
          >
            {store.settingsPublishedAt
              ? "Published storefront"
              : "Draft storefront"}
          </StatusBadge>
        </div>
        <dl className="store-info-grid">
          <div>
            <dt>Organization</dt>
            <dd>{organization.name}</dd>
          </div>
          <div>
            <dt>
              <Link2 size={15} aria-hidden="true" /> Store address
            </dt>
            <dd>/s/{store.slug}</dd>
          </div>
          <div>
            <dt>
              <CalendarDays size={15} aria-hidden="true" /> Created · UTC
            </dt>
            <dd>
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(store.createdAt)}
            </dd>
          </div>
        </dl>
      </section>
      <StoreSetup store={store} userId={session.user.id} />
      <section id="store-catalog" className="panel store-catalog-section">
        <div>
          <h2>Catalog</h2>
          <p className="muted">
            Products and categories belong to this store. Each product has
            separate offers for its markets.
          </p>
        </div>
        <div className="store-commerce-links">
          <Link
            className="button button-green"
            href={`/products?storeId=${store.id}`}
          >
            Products <NavigationFeedback />
          </Link>
          <Link
            className="button button-outline"
            href={`/categories?storeId=${store.id}`}
          >
            Categories <NavigationFeedback />
          </Link>
        </div>
      </section>
      <div id="store-markets">
        <Markets storeId={store.id} markets={markets} countries={countries} />
      </div>
      <div className="store-secondary-grid">
        <section id="storefront" className="panel">
          <h2>Storefront</h2>
          <p className="muted">
            Publish products with active market offers to make them available to
            customers.
          </p>
          <div className="form-actions">
            <Link className="button button-green" href={`/s/${store.slug}`}>
              Visit Store
            </Link>
            <Link
              className="button button-outline"
              href={`/pages?storeId=${store.id}`}
            >
              Manage pages
            </Link>
          </div>
        </section>
        <section id="store-apps" className="panel">
          <h2>Apps</h2>
          <p className="muted">
            Tracking and exports require explicit opt-in. Check each
            integration’s readiness before enabling it.
          </p>
          <Link
            className="button button-outline"
            href={`/apps?storeId=${store.id}`}
          >
            Browse Store Apps
          </Link>
        </section>
      </div>
    </div>
  );
}
