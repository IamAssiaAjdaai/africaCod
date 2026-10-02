import Link from "next/link";
import Image from "next/image";
import { formatMoney } from "@africacod/shared/money";
import type { ContentService } from "@africacod/domain";
type Browse = Awaited<ReturnType<ContentService["browseStore"]>>;
export function StoreGrid({
  data,
  home = false,
}: {
  data: Browse;
  home?: boolean;
}) {
  const base = `/s/${data.store.slug}`;
  const market = data.selected
    ? `?market=${encodeURIComponent(data.selected.token)}`
    : "";
  const path = data.category
    ? `${base}/category/${data.category.slug}`
    : home
      ? base
      : `${base}/products`;
  return (
    <main className="store-browse">
      {home ? (
        <section className="store-hero">
          <p className="eyebrow">{data.store.name}</p>
          <h1>{data.store.tagline || `Welcome to ${data.store.name}`}</h1>
          <p>
            Choose your delivery market. Explore products available where you
            are.
          </p>
        </section>
      ) : (
        <div className="page-heading">
          <div>
            <p className="eyebrow">{data.store.name}</p>
            <h1>{data.category?.name ?? "Products"}</h1>
          </div>
        </div>
      )}
      {home && data.store.categories.some((c) => !c.parentSlug) && (
        <nav className="store-category-links" aria-label="Browse categories">
          {data.store.categories
            .filter((c) => !c.parentSlug)
            .map((c) => (
              <Link
                className="button button-outline"
                key={c.slug}
                href={`${base}/category/${c.slug}${market}`}
              >
                {c.name}
              </Link>
            ))}
        </nav>
      )}
      {data.category && (
        <nav className="store-category-links" aria-label="Subcategories">
          {data.store.categories
            .filter((c) => c.parentSlug === data.category!.slug)
            .map((c) => (
              <Link
                className="button button-outline"
                key={c.slug}
                href={`${base}/category/${c.slug}${market}`}
              >
                {c.name}
              </Link>
            ))}
        </nav>
      )}
      {data.invalidMarket && (
        <p className="form-error" role="alert">
          This delivery market is unavailable. Choose an active market.
        </p>
      )}
      {!data.selected ? (
        <section className="empty-state">
          <h2>
            {data.store.markets.length
              ? "Choose a delivery market"
              : "This Store is preparing to open"}
          </h2>
          <p>
            {data.store.markets.length
              ? "Use the market selector above to see available products and local prices."
              : "There are no active delivery markets yet. Please check back later."}
          </p>
        </section>
      ) : (
        <>
          <div className="section-heading">
            <h2>
              {data.selected.name} · {data.selected.currency}
            </h2>
            <span className="muted">Cash on delivery</span>
          </div>
          {data.products.length ? (
            <div className="store-product-grid">
              {data.products.map((product) => (
                <Link
                  className="store-product-card"
                  key={product.slug}
                  href={`${base}/p/${product.slug}${market}`}
                >
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      unoptimized
                      width={500}
                      height={500}
                      alt={product.imageAlt}
                    />
                  ) : (
                    <div className="store-product-placeholder">
                      {product.name.slice(0, 1)}
                    </div>
                  )}
                  <div>
                    {product.categoryName && (
                      <p className="eyebrow">{product.categoryName}</p>
                    )}
                    <h3>{product.name}</h3>
                    <p className="muted">{product.subtitle}</p>
                    <div className="store-card-price">
                      <strong>
                        {formatMoney(
                          product.priceMinor,
                          product.currency,
                          data.selected!.locale,
                        )}
                      </strong>
                      {product.compareAtPriceMinor !== null && (
                        <del>
                          {formatMoney(
                            product.compareAtPriceMinor,
                            product.currency,
                            data.selected!.locale,
                          )}
                        </del>
                      )}
                    </div>
                    <span className="text-link">View product →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <section className="empty-state">
              <h3>No products available in this market yet.</h3>
              <p>Check another delivery market or come back later.</p>
            </section>
          )}
          <div className="form-actions">
            {data.page > 1 && (
              <Link href={`${path}${market}&page=${data.page - 1}`}>
                Previous products
              </Link>
            )}
            {data.hasNext && (
              <Link href={`${path}${market}&page=${data.page + 1}`}>
                More products →
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}
