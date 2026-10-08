import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeading, Badge, TableScroll, EmptyState } from "@africacod/ui";
import { site, requireOrganization } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
export default async function Pages({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string | string[] }>;
}) {
  const { session } = await requireOrganization();
  const query = await searchParams;
  const storeId =
    typeof query.storeId === "string" ? query.storeId || undefined : undefined;
  const service = site();
  const [pages, stores] = await Promise.all([
    found(service.listContentPages(session.user.id, storeId)),
    service.listStores(session.user.id),
  ]);
  return (
    <>
      <PageHeading
        eyebrow="STORE"
        title="Pages"
        description="Informational pages for your stores. Drafts stay private until published."
        action={
          stores.length ? (
            <Link
              className="button button-green"
              href={`/pages/new${storeId ? `?storeId=${storeId}` : ""}`}
            >
              Add Page
            </Link>
          ) : undefined
        }
      />
      <section className="panel">
        <form method="get" className="catalog-filters">
          <label>
            Store
            <select name="storeId" defaultValue={storeId ?? ""}>
              <option value="">All stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-outline">Filter pages</button>
        </form>
        {pages.length ? (
          <TableScroll label="Pages data table">
            <table className="markets-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Store</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Navigation</th>
                  <th>Updated (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id}>
                    <td>
                      <Link className="text-link" href={`/pages/${page.id}`}>
                        {page.title}
                      </Link>
                    </td>
                    <td>
                      {stores.find((store) => store.id === page.storeId)?.name}
                    </td>
                    <td>/{page.slug}</td>
                    <td>
                      <Badge active={page.status === "published"}>
                        {page.status}
                      </Badge>
                    </td>
                    <td>
                      {page.showInNavigation
                        ? page.navigationLabel || page.title
                        : "Hidden"}
                      {page.status === "draft" && page.showInNavigation
                        ? " · after publication"
                        : ""}
                    </td>
                    <td>
                      {page.updatedAt
                        .toISOString()
                        .slice(0, 16)
                        .replace("T", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        ) : (
          <EmptyState
            icon={<FileText size={22} />}
            title="No pages yet"
            description={
              stores.length
                ? "Create an About, Contact, FAQ or another informational page."
                : "Create a store before adding pages."
            }
            action={
              <Link
                className="button button-green"
                href={
                  stores.length
                    ? `/pages/new${storeId ? `?storeId=${storeId}` : ""}`
                    : "/stores/new"
                }
              >
                {stores.length ? "Add your first page" : "Create a store"}
              </Link>
            }
          />
        )}
      </section>
    </>
  );
}
