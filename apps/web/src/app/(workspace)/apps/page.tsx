import { PageHeading } from "@africacod/ui";
import { apps, requireOrganization } from "@/lib/server";
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
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM"
        title="Apps"
        description="Explore planned integrations. Connections and configuration are not available yet."
      />
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
                    <span className="badge badge-inactive">{app.status}</span>
                  </div>
                  <p className="muted">{app.description}</p>
                  <button className="button button-outline" disabled>
                    Configuration unavailable
                  </button>
                </article>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
