"use client";
import { useTrackingConsent } from "./tracking-consent";
import { type CSSProperties, useEffect, useRef } from "react";
import { captureVisitor } from "@/lib/visitor-capture";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import type { PublicStore } from "@africacod/domain";
export function StoreShell({
  store,
  children,
  previewBase,
}: {
  store: PublicStore;
  children: React.ReactNode;
  previewBase?: string;
}) {
  const query = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const market = query.get("market");
  const selected =
    store.markets.find((m) => m.token === market) ??
    (market === null && (previewBase || store.markets.length === 1)
      ? store.markets[0]
      : undefined);
  const consent = useTrackingConsent();
  const observed = useRef("");
  useEffect(() => {
    const identity = `${pathname}:${selected?.token ?? ""}`;
    if (
      previewBase ||
      !consent.analytics ||
      observed.current === identity ||
      pathname !== `/s/${store.slug}`
    )
      return;
    observed.current = identity;
    captureVisitor(store.slug, "store_view", selected?.token);
  }, [pathname, selected?.token, store.slug, consent.analytics, previewBase]);
  const link = (path: string) => {
    if (path.startsWith("https://")) return path;
    const target =
      previewBase && path.startsWith(`/s/${store.slug}`)
        ? path.replace(`/s/${store.slug}`, previewBase)
        : path;
    return (
      target +
      ((market ?? (previewBase ? selected?.token : undefined)) != null
        ? `${target.includes("?") ? "&" : "?"}market=${encodeURIComponent(market ?? selected!.token)}`
        : "")
    );
  };
  const settings = store.settings;
  const navLink = (item: { id: string; label: string; url: string }) => (
    <Link
      key={item.id}
      href={link(item.url)}
      target={item.url.startsWith("https://") ? "_blank" : undefined}
      rel={item.url.startsWith("https://") ? "noopener noreferrer" : undefined}
    >
      {item.label}
    </Link>
  );
  return (
    <div
      className={`storefront-shell theme-${settings.theme.mode} font-${settings.theme.font} header-${settings.theme.header}`}
      style={{ "--store-brand": settings.theme.color } as CSSProperties}
    >
      {settings.announcement.enabled && settings.announcement.text && (
        <div
          className="store-announcement"
          style={{
            backgroundColor: settings.announcement.background,
            color: settings.announcement.color,
          }}
        >
          {settings.announcement.link ? (
            <a href={settings.announcement.link} rel="noopener noreferrer">
              {settings.announcement.text}
            </a>
          ) : (
            settings.announcement.text
          )}
        </div>
      )}
      <a className="skip-link" href="#store-content">
        Skip to Store content
      </a>
      <header className="store-header">
        <div className="store-header-top">
          <Link className="store-logo-name" href={link(`/s/${store.slug}`)}>
            {settings.identity.logoDark && (
              <Image
                className="store-logo-dark"
                unoptimized
                src={`${settings.identity.logoDark}?w=320`}
                width={48}
                height={48}
                alt={`${store.name} dark logo`}
              />
            )}
            {store.logoUrl ? (
              <Image
                unoptimized
                className={
                  settings.identity.logoDark ? "store-logo-light" : undefined
                }
                src={`${store.logoUrl}?w=320`}
                width={48}
                height={48}
                alt={`${store.name} logo`}
              />
            ) : (
              <span
                className={`store-avatar ${settings.identity.logoDark ? "store-logo-light" : ""}`}
              >
                {store.name.slice(0, 1)}
              </span>
            )}
            <strong>{store.name}</strong>
          </Link>
          {settings.navigation.cta.enabled && settings.navigation.cta.url && (
            <a
              className="button button-green"
              href={link(settings.navigation.cta.url)}
              rel="noopener noreferrer"
            >
              {settings.navigation.cta.label}
            </a>
          )}
          <label>
            {previewBase ? "Previewing:" : "Store market"}
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
          {settings.navigation.header.length ? (
            settings.navigation.header.map(navLink)
          ) : (
            <>
              <Link
                aria-current={
                  pathname === `/s/${store.slug}` ? "page" : undefined
                }
                href={link(`/s/${store.slug}`)}
              >
                Home
              </Link>
              <Link
                aria-current={
                  pathname.endsWith("/products") ? "page" : undefined
                }
                href={link(`/s/${store.slug}/products`)}
              >
                Products
              </Link>
              <Link
                aria-current={
                  pathname.includes("/categor") ? "page" : undefined
                }
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
            </>
          )}
        </nav>
      </header>
      <div id="store-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="store-footer">
        <strong>{store.name}</strong>
        {settings.navigation.footer.length > 0 && (
          <nav aria-label="Footer navigation">
            {settings.navigation.footer.map(navLink)}
          </nav>
        )}
        <nav aria-label="Social links">
          {Object.entries(settings.navigation.social).flatMap(
            ([platform, url]) =>
              url
                ? [
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {platform[0].toUpperCase() + platform.slice(1)}
                    </a>,
                  ]
                : [],
          )}
        </nav>
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
