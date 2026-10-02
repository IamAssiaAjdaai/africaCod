"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import type { PublicProduct } from "@africacod/domain";
import { formatMoney } from "@africacod/shared/money";
export function PublicProductView({
  product,
  preview = false,
}: {
  product: PublicProduct;
  preview?: boolean;
}) {
  const selected = product.selected;
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{
    orderNumber: string;
    currency: string;
    totalMinor: number;
  } | null>(null);
  const key = useRef<string | null>(null),
    busy = useRef(false);
  const config = selected?.checkout;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !selected || preview) return;
    busy.current = true;
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    key.current ??= crypto.randomUUID();
    const params = new URLSearchParams(window.location.search);
    const attribution: Record<string, string | null> = {
      referrer: document.referrer || null,
      landingUrl: window.location.href,
    };
    for (const [field, param] of Object.entries({
      utmSource: "utm_source",
      utmMedium: "utm_medium",
      utmCampaign: "utm_campaign",
      utmContent: "utm_content",
      utmTerm: "utm_term",
      fbclid: "fbclid",
    }))
      attribution[field] = params.get(param);
    try {
      const response = await fetch(
        `/api/storefront/${product.storeSlug}/${product.productSlug}/checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key.current,
          },
          body: JSON.stringify({
            market: selected.token,
            name: data.get("name"),
            phone: data.get("phone"),
            region: data.get("region") ?? "",
            city: data.get("city") ?? "",
            address: data.get("address") ?? "",
            variantId: data.get("variantId") || null,
            quantity,
            attribution,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Could not place your order.");
      setReceipt(body);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Connection interrupted. Retry with the same order details.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <main className="public-storefront">
      <header className="public-brand">
        <span className="store-avatar">{product.storeName.slice(0, 1)}</span>
        <strong>{product.storeName}</strong>
        <span>Cash on delivery</span>
      </header>
      {preview && (
        <p className="preview-banner">Draft preview · Checkout is disabled</p>
      )}
      <div className="public-product-grid">
        <section className="public-gallery" aria-label="Product media">
          {product.media.length ? (
            product.media.map((image, index) => (
              <Image
                key={image.url}
                src={image.url}
                alt={image.altText}
                width={800}
                height={800}
                unoptimized
                priority={index === 0}
              />
            ))
          ) : (
            <div className="public-no-image">{product.productName}</div>
          )}
        </section>
        <section className="public-copy">
          <p className="eyebrow">{product.productName}</p>
          <h1>{product.headline}</h1>
          <p className="public-subtitle">{product.subtitle}</p>
          <ul className="public-benefits">
            {product.benefits.map((benefit, index) => (
              <li key={index}>✓ {benefit}</li>
            ))}
          </ul>
          <form
            method="get"
            className="public-market"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const url = new URL(window.location.href);
              url.searchParams.set("market", String(data.get("market")));
              window.location.assign(url.toString());
            }}
          >
            <label>
              Delivery market
              <select
                name="market"
                defaultValue={selected?.token ?? ""}
                required
              >
                <option value="" disabled>
                  Choose your market
                </option>
                {product.markets.map((market) => (
                  <option key={market.token} value={market.token}>
                    {market.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-outline">Choose market</button>
          </form>
          {product.invalidMarket && (
            <p className="form-error" role="alert">
              This market is unavailable. Choose an available delivery market.
            </p>
          )}
          {!selected && (
            <p className="muted">
              {product.markets.length
                ? "Choose a delivery market to see your price and order."
                : "This product is not available to order right now."}
            </p>
          )}
          {selected && config && (
            <>
              <div className="public-price">
                <strong>
                  {formatMoney(
                    selected.priceMinor,
                    selected.currency,
                    config.locale,
                  )}
                </strong>
                {selected.compareAtPriceMinor && (
                  <del>
                    {formatMoney(
                      selected.compareAtPriceMinor,
                      selected.currency,
                      config.locale,
                    )}
                  </del>
                )}
                <small>Delivering to {selected.name}</small>
              </div>
              {receipt ? (
                <section className="public-receipt" role="status">
                  <span className="eyebrow">ORDER RECEIVED</span>
                  <h2>Thank you for your order.</h2>
                  <p>
                    Your reference: <strong>{receipt.orderNumber}</strong>
                  </p>
                  <p>
                    {formatMoney(
                      receipt.totalMinor,
                      receipt.currency,
                      config.locale,
                    )}{" "}
                    · Cash on delivery
                  </p>
                  <button
                    className="button button-green"
                    onClick={() => {
                      key.current = null;
                      setReceipt(null);
                    }}
                  >
                    Place another order
                  </button>
                </section>
              ) : (
                <form
                  id="cod-checkout"
                  className="catalog-form public-checkout"
                  onSubmit={submit}
                >
                  <h2>Your delivery details</h2>
                  <p className="muted">{product.trustMessage}</p>
                  {product.variants.length > 0 && (
                    <label>
                      Variant
                      <select name="variantId">
                        <option value="">No preference</option>
                        {product.variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Quantity
                    <input
                      name="quantity"
                      type="number"
                      min={1}
                      max={20}
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Full name
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={150}
                    />
                  </label>
                  <label>
                    {config.phoneLabel}
                    <input
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      maxLength={40}
                      placeholder={
                        config.callingCode
                          ? `+${config.callingCode}…`
                          : "International phone number"
                      }
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      {config.regionLabel}
                      <input
                        name="region"
                        autoComplete="address-level1"
                        required={config.regionRequired}
                        minLength={config.regionRequired ? 2 : undefined}
                        maxLength={150}
                      />
                    </label>
                    <label>
                      {config.cityLabel}
                      <input
                        name="city"
                        autoComplete="address-level2"
                        required={config.cityRequired}
                        minLength={config.cityRequired ? 2 : undefined}
                        maxLength={150}
                      />
                    </label>
                  </div>
                  <label>
                    {config.addressLabel}
                    <textarea
                      name="address"
                      autoComplete="street-address"
                      required={config.addressRequired}
                      minLength={config.addressRequired ? 5 : undefined}
                      maxLength={500}
                    />
                  </label>
                  <div className="public-total">
                    <span>
                      Total · Delivery fee:{" "}
                      {formatMoney(0, selected.currency, config.locale)}
                    </span>
                    <strong>
                      {Number.isSafeInteger(quantity) &&
                      quantity > 0 &&
                      quantity <= 20
                        ? formatMoney(
                            BigInt(selected.priceMinor) * BigInt(quantity),
                            selected.currency,
                            config.locale,
                          )
                        : "—"}
                    </strong>
                  </div>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    className="button button-green public-submit"
                    disabled={pending || preview}
                  >
                    {pending ? "Placing order…" : product.ctaLabel}
                  </button>
                  <p className="muted">Payment is due on delivery.</p>
                </form>
              )}
            </>
          )}
          {product.description && (
            <section className="public-description">
              <h2>About this product</h2>
              <p>{product.description}</p>
            </section>
          )}
        </section>
      </div>
      {selected && !receipt && (
        <div className="public-sticky">
          <span>
            {formatMoney(
              selected.priceMinor,
              selected.currency,
              config!.locale,
            )}
          </span>
          <a href="#cod-checkout" className="button button-green">
            {pending ? "Placing order…" : product.ctaLabel}
          </a>
        </div>
      )}
    </main>
  );
}
