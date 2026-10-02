"use client";
import { useTrackingConsent } from "./tracking-consent";
import { useEffect, useRef } from "react";
import { captureVisitor } from "@/lib/visitor-capture";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import type { PublicStore } from "@africacod/domain";
export function StoreShell({
  store,
  children,
}: {
  store: PublicStore;
  children: React.ReactNode;
}) {
  const query = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const market = query.get("market");
  const selected =
    store.markets.find((m) => m.token === market) ??
    (market === null && store.markets.length === 1
      ? store.markets[0]
      : undefined);
  const consent = useTrackingConsent();
  const observed = useRef("");
  useEffect(() => {
    const identity = `${pathname}:${selected?.token ?? ""}`;
    if (
      !consent.analytics ||
      observed.current === identity ||
      pathname !== `/s/${store.slug}`
    )
      return;
    observed.current = identity;
    captureVisitor(store.slug, "store_view", selected?.token);
  }, [pathname, selected?.token, store.slug, consent.analytics]);
  const link = (path: string) =>
    path + (market !== null ? `?market=${encodeURIComponent(market)}` : "");
  return (
    <div className="storefront-shell">
      <a className="skip-link" href="#store-content">
        Skip to Store content
      </a>
      <header className="store-header">
        <div className="store-header-top">
          <Link className="store-logo-name" href={link(`/s/${store.slug}`)}>
            {store.logoUrl ? (
              <Image
                unoptimized
                src={store.logoUrl}
                width={48}
                height={48}
                alt={`${store.name} logo`}
              />
            ) : (
              <span className="store-avatar">{store.name.slice(0, 1)}</span>
            )}
            <strong>{store.name}</strong>
          </Link>
          <label>
            Store market
            <select
              aria-label="Store market"
              value={selected?.token ?? ""}
              onChange={(event) => {
                const params = new URLSearchParams(query.toString());
                params.set("market", event.target.value);
                params.delete("page");
                router.push(`${pathname}?${params}`);
              }}
            >
              <option value="" disabled>
                Choose your market
              </option>
              {store.markets.map((m) => (
                <option key={m.token} value={m.token}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selected && (
          <p className="store-market-context">
            Delivery to {selected.name} · Prices in {selected.currency} · Cash
            on delivery
          </p>
        )}
        <nav aria-label="Store navigation">
          <Link
            aria-current={pathname === `/s/${store.slug}` ? "page" : undefined}
            href={link(`/s/${store.slug}`)}
          >
            Home
          </Link>
          <Link
            aria-current={pathname.endsWith("/products") ? "page" : undefined}
            href={link(`/s/${store.slug}/products`)}
          >
            Products
          </Link>
          <Link
            aria-current={pathname.includes("/categor") ? "page" : undefined}
            href={link(`/s/${store.slug}/categories`)}
          >
            Categories
          </Link>
          {store.pages.map((page) => (
            <Link
              key={page.slug}
              href={link(`/s/${store.slug}/pages/${page.slug}`)}
            >
              {page.label}
            </Link>
          ))}
        </nav>
      </header>
      <div id="store-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="store-footer">
        <strong>{store.name}</strong>
        {store.tagline && <p>{store.tagline}</p>}
        <div>
          {store.contactEmail && (
            <a href={`mailto:${store.contactEmail}`}>{store.contactEmail}</a>
          )}
          {store.contactPhone && (
            <a href={`tel:${store.contactPhone.replace(/[ ()-]/g, "")}`}>
              {store.contactPhone}
            </a>
          )}
        </div>
        <p>
          Cash on delivery ·{" "}
          {store.markets.map((m) => m.name).join(" · ") ||
            "No active delivery markets"}
        </p>
      </footer>
    </div>
  );
}
