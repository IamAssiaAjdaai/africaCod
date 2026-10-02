import Link from "next/link";
import { ArrowRight, Globe2, Plus, Store, Building2 } from "lucide-react";
import { PageHeading } from "@africacod/ui";
import { commerce, requireOrganization } from "@/lib/server";
export default async function Dashboard() {
  const { session, organization } = await requireOrganization();
  const service = commerce();
  const stores = await service.listStores(session.user.id);
  const markets = (
    await Promise.all(
      stores.map((store) => service.listMarkets(session.user.id, store.id)),
    )
  ).flat();
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
            Your organization
            <Building2 size={18} />
          </span>
          <strong className="stat-name">{organization.name}</strong>
          <small>
            Your role: {organization.role === "owner" ? "Owner" : "Admin"}
          </small>
        </div>
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
