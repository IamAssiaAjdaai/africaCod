import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, CalendarDays, Link2, Store } from "lucide-react";
import { Badge, PageHeading } from "@africacod/ui";
import { DomainError } from "@africacod/domain";
import { commerce, requireOrganization } from "@/lib/server";
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
    service.listCountries(session.user.id),
  ]);
  return (
    <>
      <Link className="back-link" href="/stores">
        <ArrowLeft size={16} /> All stores
      </Link>
      <PageHeading
        eyebrow="YOUR STORE"
        title={store.name}
        description="A home for your brand. A starting point for growth."
        action={
          <Badge active={store.status === "active"}>
            {store.status === "active" ? "Active store" : "Inactive store"}
          </Badge>
        }
      />
      <nav className="section-nav" aria-label="Store sections">
        <a href="#store-overview">Overview</a>
        <a href="#store-markets">Markets</a>
        <Link href={`/stores/${store.id}/settings`}>Store Settings</Link>
        <a href="#storefront">Storefront</a>
        <a href="#store-apps">Apps</a>
      </nav>
      <section id="store-overview" className="panel store-info">
        <div className="store-identity">
          <span className="store-avatar store-avatar-large">
            <Store size={30} />
          </span>
          <div>
            <h2>Store information</h2>
            <p className="muted">Part of {organization.name}</p>
          </div>
        </div>
        <div className="store-info-grid">
          <div>
            <span>
              <Link2 size={15} /> Store address
            </span>
            <strong>/{store.slug}</strong>
          </div>
          <div>
            <span>
              <CalendarDays size={15} /> Created
            </span>
            <strong>
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(store.createdAt)}
            </strong>
          </div>
          <div>
            <span>Store name</span>
            <strong>{store.name}</strong>
          </div>
        </div>
      </section>
      <div className="store-commerce-links">
        <Link
          className="button button-outline"
          href={`/products?storeId=${store.id}`}
        >
          Products
        </Link>
        <Link
          className="button button-outline"
          href={`/categories?storeId=${store.id}`}
        >
          Categories
        </Link>
      </div>
      <div id="store-markets">
        <Markets storeId={store.id} markets={markets} countries={countries} />
      </div>
      <Link
        className="button button-green"
        href={`/stores/${store.id}/settings`}
      >
        Store Settings
      </Link>
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
          Tracking and exports require explicit opt-in. Check each integration’s
          readiness before enabling it.
        </p>
        <Link
          className="button button-outline"
          href={`/apps?storeId=${store.id}`}
        >
          Browse Store Apps
        </Link>
      </section>
    </>
  );
}
