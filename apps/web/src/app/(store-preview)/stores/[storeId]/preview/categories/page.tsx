import Link from "next/link";
import { marketParam } from "@/lib/store-pages";
import { requireOrganization, storeSettings, site } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
export const metadata = { title: "Categories" };
export default async function Categories({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { storeId } = await params;
  const { session } = await requireOrganization();
  const owned = await found(storeSettings().getStore(session.user.id, storeId));
  const store = await found(site().getPublicStore(owned.slug, session.user.id));
  const market = marketParam((await searchParams).market);
  const link = (slug: string) =>
    `/stores/${storeId}/preview/category/${slug}${market !== undefined ? `?market=${encodeURIComponent(market)}` : ""}`;
  return (
    <main className="store-browse">
      <h1>Categories</h1>
      {store.categories.length ? (
        <div className="apps-grid">
          {store.categories
            .filter((c) => !c.parentSlug)
            .map((c) => (
              <section className="panel" key={c.slug}>
                <h2>
                  <Link href={link(c.slug)}>{c.name}</Link>
                </h2>
                <ul>
                  {store.categories
                    .filter((child) => child.parentSlug === c.slug)
                    .map((child) => (
                      <li key={child.slug}>
                        <Link className="text-link" href={link(child.slug)}>
                          {child.name}
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
        </div>
      ) : (
        <p className="muted">No categories available yet.</p>
      )}
    </main>
  );
}
