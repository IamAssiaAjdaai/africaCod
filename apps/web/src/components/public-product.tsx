"use client";
import { Banknote, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { type CSSProperties, useRef, useState, useEffect } from "react";
import { type BrowserConnection } from "@africacod/domain/tracking-policy";
import { useTrackingConsent } from "./tracking-consent";
import { captureVisitor } from "@/lib/visitor-capture";
import { emitBrowserTracking } from "@/lib/browser-tracking";
import Image from "next/image";
import type { PublicProduct } from "@africacod/domain";
import { formatMoney } from "@africacod/shared/money";
export function PublicProductView({
  product,
  preview = false,
  tracking = [],
}: {
  product: PublicProduct;
  preview?: boolean;
  tracking?: BrowserConnection[];
}) {
  const selected = product.selected;
  const settings = product.settings;
  const pageSettings = settings.productPage;
  const dialog = useRef<HTMLDialogElement>(null);
  const errorNode = useRef<HTMLParagraphElement>(null);
  const buttonLabel = "Order Now";
  const buttonStyle = {
    backgroundColor: pageSettings.buttonBackground ?? settings.theme.color,
    color: pageSettings.buttonColor ?? "#ffffff",
  } as CSSProperties;
  function openOrder() {
    if (pageSettings.mode === "popup") dialog.current?.showModal();
    else
      document
        .getElementById("cod-checkout")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{
    orderNumber: string;
    currency: string;
    totalMinor: number;
  } | null>(null);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (receipt) {
      dialog.current?.close();
      receiptHeading.current?.focus();
    }
  }, [receipt]);
  useEffect(() => {
    if (error) errorNode.current?.focus();
  }, [error]);
  const key = useRef<string | null>(null),
    busy = useRef(false);
  const config = selected?.checkout;
  const consent = useTrackingConsent();
  const marketingViewed = useRef(false);
  const viewed = useRef(false);
  const checkoutStarted = useRef(false);
  useEffect(() => {
    if (preview || !selected) return;
    if (consent.marketing && !marketingViewed.current) {
      marketingViewed.current = true;
      emitBrowserTracking(tracking, "view");
    }
    if (!consent.analytics || viewed.current) return;
    viewed.current = true;
    if (navigator.doNotTrack === "1") return;
    void fetch(
      `/api/storefront/${product.storeSlug}/${product.productSlug}/view`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: selected.token,
          eventId: crypto.randomUUID(),
        }),
      },
    ).catch(() => {});
  }, [
    preview,
    selected,
    tracking,
    product.storeSlug,
    product.productSlug,
    consent.analytics,
    consent.marketing,
  ]);
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
            whatsapp: data.get("whatsapp") ?? "",
            notes: data.get("notes") ?? "",
            customFields: Object.fromEntries(
              pageSettings.customFields
                .filter((f) => f.enabled)
                .map((f) => [f.id, String(data.get(`custom:${f.id}`) ?? "")]),
            ),
            attribution,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Could not place your order.");
      setReceipt(body);
      if (consent.marketing)
        emitBrowserTracking(tracking, "checkout", body.orderNumber);
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
  const checkoutForm =
    selected && config ? (
      <form
        id="cod-checkout"
        className="catalog-form public-checkout"
        onFocus={() => {
          if (preview || !consent.analytics || checkoutStarted.current) return;
          checkoutStarted.current = true;
          captureVisitor(
            product.storeSlug,
            "checkout_started",
            selected.token,
            product.productSlug,
          );
        }}
        onSubmit={submit}
        aria-describedby={error ? "checkout-error" : undefined}
      >
        <h2>Your delivery details</h2>
        <p className="muted">{product.trustMessage}</p>
        {product.variants.length > 0 && (
          <label>
            Variant
            <select name="variantId" disabled={pending}>
              <option value="">No preference</option>
              {product.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {pageSettings.quantity && (
          <label>
            Quantity
            <input
              disabled={pending}
              name="quantity"
              type="number"
              min={1}
              max={20}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
        )}
        {[...pageSettings.fields, ...pageSettings.customFields]
          .sort((a, b) => a.order - b.order)
          .map((field) => {
            if ("type" in field) {
              if (!field.enabled) return null;
              return (
                <label key={field.id}>
                  {field.label}
                  {field.type === "textarea" ? (
                    <textarea
                      name={`custom:${field.id}`}
                      required={field.required}
                      disabled={pending}
                      maxLength={2000}
                    />
                  ) : field.type === "select" ? (
                    <select
                      name={`custom:${field.id}`}
                      required={field.required}
                      disabled={pending}
                    >
                      <option value="">Choose an option</option>
                      {field.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={`custom:${field.id}`}
                      required={field.required}
                      disabled={pending}
                      maxLength={500}
                    />
                  )}
                </label>
              );
            }
            const authoritative =
              field.id === "name" ||
              field.id === "phone" ||
              (field.id === "region" && config.regionRequired) ||
              (field.id === "city" && config.cityRequired) ||
              (field.id === "address" && config.addressRequired);
            if (!field.enabled && !authoritative) return null;
            const required = authoritative || field.required;
            const label = {
              name: "Full name",
              phone: config.phoneLabel,
              region: config.regionLabel,
              city: config.cityLabel,
              address: config.addressLabel,
              whatsapp: "WhatsApp",
              notes: "Notes",
            }[field.id];
            const autoComplete = {
              name: "name",
              phone: "tel",
              region: "address-level1",
              city: "address-level2",
              address: "street-address",
              whatsapp: "off",
              notes: "off",
            }[field.id];
            return (
              <label key={field.id}>
                {label}
                {field.id === "address" || field.id === "notes" ? (
                  <textarea
                    name={field.id}
                    disabled={pending}
                    required={required}
                    autoComplete={autoComplete}
                    minLength={
                      required ? (field.id === "address" ? 5 : 1) : undefined
                    }
                    maxLength={field.id === "notes" ? 2000 : 500}
                  />
                ) : (
                  <input
                    name={field.id}
                    disabled={pending}
                    required={required}
                    autoComplete={autoComplete}
                    type={
                      field.id === "phone" || field.id === "whatsapp"
                        ? "tel"
                        : "text"
                    }
                    inputMode={
                      field.id === "phone" || field.id === "whatsapp"
                        ? "tel"
                        : undefined
                    }
                    minLength={required ? 2 : undefined}
                    maxLength={
                      field.id === "phone" || field.id === "whatsapp" ? 40 : 150
                    }
                  />
                )}
              </label>
            );
          })}
        <div className="public-total">
          <span>
            Total · Delivery fee:{" "}
            {formatMoney(0, selected.currency, config.locale)}
          </span>
          <strong>
            {Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 20
              ? formatMoney(
                  BigInt(selected.priceMinor) * BigInt(quantity),
                  selected.currency,
                  config.locale,
                )
              : "—"}
          </strong>
        </div>
        {error && (
          <p
            className="form-error"
            role="alert"
            id="checkout-error"
            ref={errorNode}
            tabIndex={-1}
          >
            {error}
          </p>
        )}
        <button
          className="button button-green public-submit"
          style={buttonStyle}
          disabled={pending || preview}
        >
          {pending ? "Placing order…" : buttonLabel}
        </button>
        <p className="muted">Payment is due on delivery.</p>
      </form>
    ) : null;
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
              <picture key={image.url}>
                {!preview && (
                  <source
                    srcSet={[320, 640, 960, 1600]
                      .map((w) => `${image.url}?w=${w} ${w}w`)
                      .join(", ")}
                    sizes="(max-width: 760px) 100vw, 50vw"
                  />
                )}
                <Image
                  src={preview ? image.url : `${image.url}?w=960`}
                  alt={image.altText}
                  width={800}
                  height={800}
                  unoptimized
                  priority={index === 0}
                  sizes="(max-width: 760px) 100vw, 50vw"
                />
              </picture>
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
                  <h2 ref={receiptHeading} tabIndex={-1}>
                    Thank you for your order.
                  </h2>
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
                  <p>
                    We’ll contact you to confirm delivery details. Payment is
                    due on delivery.
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
                <>
                  {pageSettings.mode === "popup" ? (
                    <>
                      <button
                        type="button"
                        className="button button-green public-submit"
                        style={buttonStyle}
                        onClick={openOrder}
                      >
                        {buttonLabel}
                      </button>
                      <dialog
                        ref={dialog}
                        className="checkout-dialog"
                        aria-label="Cash on delivery order"
                      >
                        <button
                          type="button"
                          className="button button-outline dialog-close"
                          onClick={() => dialog.current?.close()}
                        >
                          Close order form
                        </button>
                        {checkoutForm}
                      </dialog>
                    </>
                  ) : (
                    checkoutForm
                  )}
                  {pageSettings.trustBadges && (
                    <ul className="trust-badge-list">
                      {[...pageSettings.badges]
                        .filter((b) => b.enabled)
                        .sort((a, b) => a.order - b.order)
                        .map((b) => {
                          const Icon = {
                            cash: Banknote,
                            truck: Truck,
                            shield: ShieldCheck,
                            return: RotateCcw,
                          }[b.icon];
                          return (
                            <li key={b.id}>
                              <Icon size={18} aria-hidden="true" />
                              {b.label}
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </>
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
      {selected && !receipt && pageSettings.sticky && (
        <div className="public-sticky">
          <span>
            {formatMoney(
              selected.priceMinor,
              selected.currency,
              config!.locale,
            )}
          </span>
          <button
            type="button"
            onClick={openOrder}
            style={buttonStyle}
            className="button button-green"
          >
            {pending ? "Placing order…" : buttonLabel}
          </button>
        </div>
      )}
    </main>
  );
}
