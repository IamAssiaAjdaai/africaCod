import Link from "next/link";
import { PageHeading } from "@africacod/ui";
import { site, requireOrganization } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { ContentEditor } from "@/components/content-editor";
export default async function NewPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string | string[] }>;
}) {
  const { session } = await requireOrganization();
  const service = site();
  const stores = await service.listStores(session.user.id);
  const query = await searchParams;
  const id = typeof query.storeId === "string" ? query.storeId : stores[0]?.id;
  const store = id ? await found(service.getStore(session.user.id, id)) : null;
  return (
    <>
      <Link className="back-link" href="/pages">
        ← Pages
      </Link>
      <PageHeading
        title="Create Page"
        description="Create a private draft, then preview and publish."
      />
      {store ? (
        <>
          <form method="get" className="catalog-filters">
            <label>
              Store
              <select name="storeId" defaultValue={store.id}>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-outline">Choose store</button>
          </form>
          <ContentEditor
            key={store.id}
            storeId={store.id}
            storeSlug={store.slug}
          />
        </>
      ) : (
        <section className="panel">
          <Link className="button button-green" href="/stores/new">
            Create a store first
          </Link>
        </section>
      )}
    </>
  );
}
