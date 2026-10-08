import { Badge, PageHeading } from "@africacod/ui";
import Link from "next/link";
import {
  apps,
  requireOrganization,
  providerTestMode,
  providers,
  tracking,
  trackingTestMode,
} from "@/lib/server";
import { found } from "@/lib/catalog-pages";
export default async function Apps({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string | string[] }>;
}) {
  const { session } = await requireOrganization();
  const query = await searchParams;
  const catalog = await found(
    apps().listApps(
      session.user.id,
      typeof query.storeId === "string"
        ? query.storeId || undefined
        : undefined,
    ),
  );
  const stores = await providers().listStores(session.user.id);
  const selectedStoreId =
    typeof query.storeId === "string"
      ? query.storeId || stores[0]?.id
      : stores[0]?.id;
  const connection = selectedStoreId
    ? await providers().connectionForStore(session.user.id, selectedStoreId)
    : null;
  const trackingConnections = selectedStoreId
    ? await Promise.all(
        ["meta", "tiktok", "google-ads", "google-sheets"].map((p) =>
          tracking().connection(session.user.id, selectedStoreId, p),
        ),
      )
    : [];
  function connectionStatus(id: string) {
    if (id === "shipcod") {
      if (!providerTestMode()) return "Production API access required";
      if (!connection) return "Available (test adapter)";
      return connection.status === "connected" &&
        connection.adapterMode === "mock"
        ? "Connected (test adapter)"
        : "Not connected (test adapter)";
    }
    if (!["meta", "tiktok", "google-ads", "google-sheets"].includes(id))
      return "Coming soon";
    const c = trackingConnections.find((c) => c?.provider === id);
    if (!trackingTestMode() && id === "google-sheets" && !c)
      return "Production setup required";
    if (c) {
      if (c.mode === "mock" && !trackingTestMode())
        return "Not connected (test adapter disabled)";
      if (c.enabled && c.lastSuccess && !c.lastError)
        return c.mode === "mock" ? "Connected (test adapter)" : "Connected";
      if (c.enabled && c.mode === "browser")
        return "Configured (browser; receipt unverified)";
      return c.mode === "mock"
        ? "Not connected (test adapter)"
        : "Not connected";
    }
    return trackingTestMode()
      ? "Available (test adapter)"
      : id === "meta"
        ? "Available (Pixel + CAPI)"
        : "Available (browser foundation)";
  }
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM"
        title="Apps"
        description="Configure store tracking, order exports and fulfillment."
      />
      <section className="panel integration-guidance">
        <h2>Choose what your Store connects</h2>
        <p>
          Marketing integrations remain PARTIAL. Sheets OAuth and export require
          external credentials and live merchant authorization. Configuration
          availability does not mean verified production delivery. ShipCOD
          offers a test adapter; production API access remains blocked.
        </p>
        {!trackingConnections.some((c) => c?.enabled) && (
          <p className="muted">
            No tracking Apps enabled for this Store. Browse Apps below to
            configure an integration explicitly.
          </p>
        )}
      </section>
      {!stores.length && (
        <section className="panel empty-state">
          <h2>Create a Store first</h2>
          <p>
            Connections belong to a Store and are never enabled automatically.
          </p>
          <Link className="button button-green" href="/stores/new">
            Create store
          </Link>
        </section>
      )}
      {stores.length > 0 && (
        <form method="get" className="panel catalog-filters">
          <label>
            Store
            <select name="storeId" defaultValue={selectedStoreId}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-outline">Select store</button>
        </form>
      )}
      {["Marketing", "Data", "Communication", "Fulfillment"].map((category) => (
        <section className="apps-category" key={category}>
          <h2>{category}</h2>
          <div className="apps-grid">
            {catalog
              .filter((app) => app.category === category)
              .map((app) => (
                <article className="panel app-card" key={app.id}>
                  <div className="section-heading">
                    <h3>{app.name}</h3>
                    <Badge
                      tone={
                        connectionStatus(app.id).startsWith("Connected")
                          ? "success"
                          : "neutral"
                      }
                    >
                      {connectionStatus(app.id)}
                    </Badge>
                  </div>
                  {["meta", "tiktok", "google-ads", "google-sheets"].includes(
                    app.id,
                  ) && (
                    <p className="integration-readiness">
                      <strong>PARTIAL</strong> · configuration available
                    </p>
                  )}
                  {app.id === "shipcod" && (
                    <p className="integration-readiness">
                      <strong>TEST ADAPTER</strong> · production API blocked
                    </p>
                  )}
                  <p className="muted">{app.description}</p>
                  {app.id === "shipcod" ? (
                    <Link
                      className="button button-outline"
                      href={
                        selectedStoreId
                          ? `/apps/shipcod?storeId=${selectedStoreId}`
                          : "/apps/shipcod"
                      }
                    >
                      Configure ShipCOD
                    </Link>
                  ) : [
                      "meta",
                      "tiktok",
                      "google-ads",
                      "google-sheets",
                    ].includes(app.id) ? (
                    <Link
                      className="button button-outline"
                      href={`/apps/${app.id}${selectedStoreId ? `?storeId=${selectedStoreId}` : ""}`}
                    >
                      Configure {app.name}
                    </Link>
                  ) : (
                    <button className="button button-outline" disabled>
                      Configuration unavailable
                    </button>
                  )}
                </article>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
