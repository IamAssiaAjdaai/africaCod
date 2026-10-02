import Link from "next/link";
import { publicStore, marketParam } from "@/lib/store-pages";
export const metadata = { title: "Categories" };
export default async function Categories({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const { storeSlug } = await params;
  const store = await publicStore(storeSlug);
  const market = marketParam((await searchParams).market);
  const link = (slug: string) =>
    `/s/${storeSlug}/category/${slug}${market !== undefined ? `?market=${encodeURIComponent(market)}` : ""}`;
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
