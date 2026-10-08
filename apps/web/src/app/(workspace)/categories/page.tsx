import Link from "next/link";
import { FolderTree, Plus, Search } from "lucide-react";
import { PageHeading, Badge, TableScroll } from "@africacod/ui";
import { catalog, requireOrganization } from "@/lib/server";
import { found, scalar } from "@/lib/catalog-pages";
import { StoreChoice } from "@/components/catalog-forms";
export default async function Categories({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireOrganization();
  const query = await searchParams;
  const service = catalog();
  const stores = await service.listStores(session.user.id);
  const storeId = scalar(query.storeId) || stores[0]?.id;
  const rows = storeId
    ? await found(service.listCategories(session.user.id, storeId))
    : [];
  const products = storeId
    ? await service.listProducts(session.user.id, storeId)
    : [];
  const status = scalar(query.status);
  const subcategories = scalar(query.tab) === "subcategories";
  const q = scalar(query.q);
  const filtered = rows.filter(
    (row) =>
      Boolean(row.parentId) === subcategories &&
      (!status || row.status === status) &&
      row.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="CATALOG"
        title="Categories"
        description="Organize products with categories and subcategories."
        action={
          storeId ? (
            <Link
              href={`/categories/new?storeId=${storeId}`}
              className="button button-green"
            >
              <Plus size={16} />
              Add Category
            </Link>
          ) : undefined
        }
      />
      {!storeId ? (
        <section className="panel catalog-empty">
          <FolderTree size={34} />
          <h2>Create a store first</h2>
          <p className="muted">Categories belong to a store.</p>
          <Link href="/stores/new" className="button button-green">
            Create store
          </Link>
        </section>
      ) : (
        <>
          <StoreChoice stores={stores} storeId={storeId} route="/categories" />
          <section className="panel">
            <div className="catalog-toolbar">
              <nav className="catalog-tabs" aria-label="Category levels">
                <Link
                  aria-current={!subcategories ? "page" : undefined}
                  href={`/categories?storeId=${storeId}`}
                >
                  Categories{" "}
                  <span>{rows.filter((row) => !row.parentId).length}</span>
                </Link>
                <Link
                  aria-current={subcategories ? "page" : undefined}
                  href={`/categories?storeId=${storeId}&tab=subcategories`}
                >
                  Subcategories{" "}
                  <span>{rows.filter((row) => row.parentId).length}</span>
                </Link>
              </nav>
              <Link
                className="button button-outline button-small"
                href={`/categories/new?storeId=${storeId}&sub=1`}
              >
                <Plus size={15} />
                Add Subcategory
              </Link>
            </div>
            <form className="catalog-filters" method="get">
              <input type="hidden" name="storeId" value={storeId} />
              <input
                type="hidden"
                name="tab"
                value={subcategories ? "subcategories" : "categories"}
              />
              <label className="search-field">
                <Search size={16} />
                <input
                  aria-label="Search categories"
                  name="q"
                  defaultValue={q}
                  placeholder="Search categories"
                />
              </label>
              <label>
                Status
                <select name="status" defaultValue={status}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <button className="button button-outline button-small">
                Search
              </button>
            </form>
            {filtered.length ? (
              <TableScroll label="Categories data table">
                <table className="markets-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>
                        {subcategories ? "Parent category" : "Subcategories"}
                      </th>
                      <th>Products</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link
                            href={`/categories/${row.id}`}
                            className="text-link"
                          >
                            {row.name}
                          </Link>
                          <small className="catalog-slug">/{row.slug}</small>
                        </td>
                        <td>
                          {subcategories
                            ? rows.find((parent) => parent.id === row.parentId)
                                ?.name
                            : rows
                                .filter((sub) => sub.parentId === row.id)
                                .map((sub) => sub.name)
                                .join(", ") || "—"}
                        </td>
                        <td>
                          {
                            products.filter(
                              (p) =>
                                p.categoryId === row.id ||
                                p.subcategoryId === row.id,
                            ).length
                          }
                        </td>
                        <td>
                          <Badge active={row.status === "active"}>
                            {row.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <div className="catalog-row-actions">
                            <Link
                              href={`/categories/${row.id}`}
                              className="button button-outline button-small"
                            >
                              Edit
                            </Link>
                            {!row.parentId && (
                              <Link
                                href={`/categories/new?storeId=${storeId}&parentId=${row.id}`}
                                className="text-link"
                              >
                                Add subcategory
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            ) : (
              <div className="catalog-empty">
                <FolderTree size={32} />
                <h2>
                  {q
                    ? "No matches found"
                    : subcategories
                      ? "No subcategories yet"
                      : "No categories yet"}
                </h2>
                <p className="muted">
                  {q
                    ? "Try a different search."
                    : subcategories
                      ? "Add a subcategory beneath a top-level category."
                      : "Start with a category like Beauty, then add Hair or Skin."}
                </p>
                <Link
                  className="button button-green"
                  href={`/categories/new?storeId=${storeId}${subcategories ? "&sub=1" : ""}`}
                >
                  {subcategories ? "Add Subcategory" : "Add Category"}
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
