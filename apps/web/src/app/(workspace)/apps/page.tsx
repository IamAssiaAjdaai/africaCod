import { PageHeading } from "@africacod/ui";
import Link from "next/link";
import {
  apps,
  requireOrganization,
  providerTestMode,
  providers,
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
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM"
        title="Apps"
        description="Configure store fulfillment and explore planned integrations."
      />
      {stores.length > 0 && (
        <form method="get" className="panel">
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
                    <span className="badge badge-inactive">
                      {app.id === "shipcod" && providerTestMode()
                        ? connection?.status === "connected" &&
                          connection.adapterMode === "mock"
                          ? "Connected (test adapter)"
                          : connection
                            ? "Not connected (test adapter)"
                            : "Available (test adapter)"
                        : app.status}
                    </span>
                  </div>
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
