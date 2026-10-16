import Image from "next/image";
import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import {
  PageHeading,
  Badge,
  TableScroll,
  EmptyState,
  StatusBadge,
} from "@africacod/ui";
import { formatMoney } from "@africacod/shared/money";
import { catalog, requireOrganization } from "@/lib/server";
import { found, scalar } from "@/lib/catalog-pages";
import { NavigationFeedback } from "@/components/navigation-feedback";
export default async function Products({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session } = await requireOrganization();
  const query = await searchParams;
  const service = catalog();
  const [stores, data] = await Promise.all([
    service.listStores(session.user.id),
    service.productListData(session.user.id),
  ]);
  const storeId = scalar(query.storeId);
  if (storeId) await found(service.getStore(session.user.id, storeId));
  const q = scalar(query.q);
  const status = scalar(query.status);
  const rows = data.products.filter(
    (product) =>
      (!storeId || product.storeId === storeId) &&
      (!status || product.status === status) &&
      `${product.name} ${product.sku ?? ""}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const newLink = `/products/new${storeId || stores[0] ? `?storeId=${storeId || stores[0].id}` : ""}`;
  return (
    <div className="products-page">
      <PageHeading
        eyebrow="CATALOG"
        title="Products"
        description="Manage each store’s catalog and its independent market offers."
        action={
          <Link className="button button-green" href={newLink}>
            <Plus size={16} aria-hidden="true" />
            Add Product
          </Link>
        }
      />
      <section className="panel">
        <form
          key={`${storeId}:${status}:${q}`}
          className="catalog-filters"
          method="get"
          aria-label="Product filters"
        >
          <label className="product-search">
            Search products
            <span className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name or SKU"
              />
            </span>
          </label>
          <label>
            Store
            <select name="storeId" defaultValue={storeId}>
              <option value="">All stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className="product-filter-actions">
            <button className="button button-outline button-small">
              Apply filters
            </button>
            {(q || status || storeId) && (
              <Link className="text-link" href="/products">
                Clear filters
              </Link>
            )}
          </div>
        </form>
        <div className="product-results">
          <p>
            {rows.length} {rows.length === 1 ? "product" : "products"}
          </p>
          <p className="muted">
            Product status, market offers and page publication are managed
            separately.
          </p>
        </div>
        {rows.length ? (
          <TableScroll label="Products data table">
            <table className="markets-table product-table" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Product
                  </th>
                  <th scope="col" role="columnheader">
                    SKU
                  </th>
                  <th scope="col" role="columnheader">
                    Category
                  </th>
                  <th scope="col" role="columnheader">
                    Status
                  </th>
                  <th scope="col" role="columnheader">
                    Configured market offers
                  </th>
                  <th scope="col" role="columnheader">
                    Product Page
                  </th>
                  <th scope="col" role="columnheader">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {rows.map((product) => {
                  const image = data.media.find(
                    (row) => row.productId === product.id,
                  );
                  const offers = data.offers.filter(
                    (row) => row.productId === product.id,
                  );
                  return (
                    <tr key={product.id} role="row">
                      <td className="product-identity-cell" role="cell">
                        <Link
                          className="product-list-name"
                          href={`/products/${product.id}`}
                        >
                          {image ? (
                            <Image
                              src={`/api/media/${image.id}`}
                              alt={image.altText ?? product.name}
                              width={48}
                              height={48}
                              unoptimized
                            />
                          ) : (
                            <span className="product-thumb">
                              <Package size={22} aria-hidden="true" />
                            </span>
                          )}
                          <span>
                            <strong>{product.name}</strong>
                            <small>
                              {
                                stores.find(
                                  (store) => store.id === product.storeId,
                                )?.name
                              }
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td role="cell">
                        <span className="mobile-cell-label" aria-hidden="true">
                          SKU
                        </span>
                        {product.sku ?? "—"}
                      </td>
                      <td role="cell">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Category
                        </span>
                        {data.categories.find(
                          (row) =>
                            row.id ===
                            (product.subcategoryId ?? product.categoryId),
                        )?.name ?? "—"}
                      </td>
                      <td className="product-status-cell" role="cell">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Product status
                        </span>
                        <StatusBadge status={product.status}>
                          {product.status[0].toUpperCase() +
                            product.status.slice(1)}
                        </StatusBadge>
                      </td>
                      <td className="product-offers-cell" role="cell">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Market offers
                        </span>
                        {offers.length ? (
                          <div className="offer-tags">
                            {offers.map((offer) => (
                              <span
                                key={offer.id}
                                className={
                                  offer.status === "inactive"
                                    ? "offer-tag muted"
                                    : "offer-tag"
                                }
                              >
                                {
                                  data.markets.find(
                                    (market) =>
                                      market.id === offer.storeMarketId,
                                  )?.name
                                }{" "}
                                ·{" "}
                                {formatMoney(offer.priceMinor, offer.currency)}
                                {offer.status === "inactive"
                                  ? " · Inactive"
                                  : " · Active"}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">No offers yet</span>
                        )}
                      </td>
                      <td className="product-page-cell" role="cell">
                        <span className="mobile-cell-label" aria-hidden="true">
                          Product Page
                        </span>
                        <Badge
                          active={data.pages.some(
                            (page) =>
                              page.productId === product.id &&
                              page.status === "published",
                          )}
                        >
                          {data.pages.some(
                            (page) =>
                              page.productId === product.id &&
                              page.status === "published",
                          )
                            ? "Published"
                            : "Draft"}
                        </Badge>
                      </td>
                      <td className="product-actions-cell" role="cell">
                        <Link
                          className="button button-outline button-small"
                          href={`/products/${product.id}`}
                          aria-label={`Edit ${product.name}`}
                        >
                          Edit
                          <NavigationFeedback />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        ) : (
          <EmptyState
            icon={<Package size={22} />}
            title={
              q || status || (storeId && data.products.length)
                ? "No products match"
                : "No products yet"
            }
            description={
              q || status || (storeId && data.products.length)
                ? "Try another store, search or status filter. Clear filters to see the full catalog."
                : "Add product details and images, then configure offers for each market."
            }
            action={
              <div className="form-actions">
                {q || status || (storeId && data.products.length) ? (
                  <Link className="button button-outline" href="/products">
                    Clear all filters
                  </Link>
                ) : null}
                <Link
                  className="button button-green"
                  href={stores.length ? newLink : "/stores/new"}
                >
                  {stores.length ? "Add Product" : "Create store"}
                </Link>
              </div>
            }
          />
        )}
      </section>
    </div>
  );
}
