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
    <>
      <PageHeading
        eyebrow="CATALOG"
        title="Products"
        description="One catalog. Independent offers for every market."
        action={
          <Link className="button button-green" href={newLink}>
            <Plus size={16} />
            Add Product
          </Link>
        }
      />
      <section className="panel">
        <form className="catalog-filters" method="get">
          <label className="search-field">
            <Search size={16} />
            <input
              name="q"
              defaultValue={q}
              aria-label="Search products"
              placeholder="Search name or SKU"
            />
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
          <button className="button button-outline button-small">
            Apply filters
          </button>
        </form>
        {rows.length ? (
          <TableScroll label="Products data table">
            <table className="markets-table product-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Configured market offers</th>
                  <th>Product Page</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const image = data.media.find(
                    (row) => row.productId === product.id,
                  );
                  const offers = data.offers.filter(
                    (row) => row.productId === product.id,
                  );
                  return (
                    <tr key={product.id}>
                      <td>
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
                              <Package size={22} />
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
                      <td>{product.sku ?? "—"}</td>
                      <td>
                        {data.categories.find(
                          (row) =>
                            row.id ===
                            (product.subcategoryId ?? product.categoryId),
                        )?.name ?? "—"}
                      </td>
                      <td>
                        <StatusBadge status={product.status}>
                          {product.status[0].toUpperCase() +
                            product.status.slice(1)}
                        </StatusBadge>
                      </td>
                      <td>
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
                      <td>
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
                      <td>
                        <Link
                          className="button button-outline button-small"
                          href={`/products/${product.id}`}
                        >
                          Edit
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
              q || status
                ? "Try another search or filter."
                : "Add product details and images, then configure offers for each market."
            }
            action={
              <Link
                className="button button-green"
                href={stores.length ? newLink : "/stores/new"}
              >
                {stores.length ? "Add Product" : "Create store"}
              </Link>
            }
          />
        )}
      </section>
    </>
  );
}
