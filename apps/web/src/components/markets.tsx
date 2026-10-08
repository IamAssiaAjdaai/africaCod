"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Globe2, MapPin, Plus, X } from "lucide-react";
import { Badge, TableScroll } from "@africacod/ui";
import { addMarketAction, setMarketStatusAction } from "@/lib/actions";
type Market = {
  id: string;
  countryCode: string | null;
  countryName: string;
  currency: string;
  locale: string;
  status: "active" | "inactive";
};
type Country = {
  code: string;
  name: string;
  currencyCode: string;
  defaultLocale: string;
  callingCode: string | null;
};
function flag(code: string) {
  return String.fromCodePoint(
    ...[...code].map((c) => c.charCodeAt(0) + 127397),
  );
}
export function Markets({
  storeId,
  markets,
  countries,
}: {
  storeId: string;
  markets: Market[];
  countries: Country[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  function openPicker() {
    setSelected("");
    setQuery("");
    dialog.current?.showModal();
  }
  const [selected, setSelected] = useState("");
  const [state, action, pending] = useActionState(addMarketAction, {});
  useEffect(() => {
    if (state.success) {
      dialog.current?.close();
    }
  }, [state]);
  const available = countries.filter(
    (c) => !markets.some((m) => m.countryCode === c.code),
  );
  const normalizeSearch = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const filtered = available.filter((country) =>
    normalizeSearch(`${country.name} ${country.code}`).includes(
      normalizeSearch(query),
    ),
  );
  return (
    <section className="panel markets-panel">
      <div className="section-heading">
        <div>
          <div className="panel-heading">
            <Globe2 size={20} />
            <h2>Markets</h2>
            <span className="count-pill">{markets.length}</span>
          </div>
          <p className="muted">The countries where your store does business.</p>
        </div>
        <button
          className="button button-green"
          onClick={openPicker}
          disabled={available.length === 0}
        >
          <Plus size={16} /> Add Market
        </button>
      </div>
      {markets.length === 0 ? (
        <div className="empty-state market-empty">
          <div className="market-empty-art">
            <span className="empty-icon">
              <Globe2 size={33} strokeWidth={1.3} />
            </span>
            <MapPin size={19} />
          </div>
          <h3>No markets yet</h3>
          <p>Add the countries where you want to sell.</p>
          <button className="button button-outline" onClick={openPicker}>
            <Plus size={16} /> Add Market
          </button>
          <small>You’re in control. No markets are added automatically.</small>
        </div>
      ) : (
        <>
          <TableScroll label="Configured markets data table">
            <table className="markets-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Currency</th>
                  <th>Locale</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr key={market.id}>
                    <td>
                      <span className="country-label">
                        <span className="country-flag">
                          {market.countryCode ? (
                            flag(market.countryCode)
                          ) : (
                            <Globe2 size={20} />
                          )}
                        </span>
                        <span>
                          <strong>{market.countryName}</strong>
                          <small>{market.countryCode ?? "Custom"}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="currency-tag">{market.currency}</span>
                    </td>
                    <td className="muted">{market.locale}</td>
                    <td>
                      <Badge active={market.status === "active"}>
                        {market.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      <MarketToggle storeId={storeId} market={market} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <div className="markets-footnote">
            <Check size={15} /> Deactivating a market keeps its settings for
            when you’re ready to return.
          </div>
        </>
      )}
      {state.success && (
        <p role="status" className="success-note">
          {state.success}{" "}
          <Link href={`/products/new?storeId=${storeId}`}>
            Create your first Product
          </Link>
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="market-dialog-title"
        className="market-dialog"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <div className="dialog-header">
          <span className="onboarding-icon">
            <Globe2 size={23} />
          </span>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="market-dialog-title">Add a market</h2>
        <p className="muted">
          Choose an African country for your store. Currency and locale defaults
          are copied to its market settings.
        </p>
        <form action={action}>
          <input type="hidden" name="storeId" value={storeId} />
          <fieldset disabled={pending}>
            <legend className="field-label">Available markets</legend>
            <label className="field-label" htmlFor="country-search">
              Search countries
            </label>
            <input
              id="country-search"
              type="search"
              placeholder="Country name or ISO code"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected("");
              }}
            />
            <p className="muted" role="status">
              {filtered.length} countries available
            </p>
            {filtered.length === 0 && (
              <p>No countries found. Try another name or country code.</p>
            )}
            <div className="country-options">
              {filtered.map((country) => (
                <label
                  className={`country-option ${selected === country.code ? "country-selected" : ""}`}
                  key={country.code}
                >
                  <input
                    type="radio"
                    name="countryCode"
                    value={country.code}
                    checked={selected === country.code}
                    onChange={() => setSelected(country.code)}
                    required
                  />
                  <span className="country-flag">{flag(country.code)}</span>
                  <span>
                    <strong>{country.name}</strong>
                    <small>
                      {country.currencyCode} · {country.defaultLocale}
                    </small>
                  </span>
                  <span className="selection-circle">
                    {selected === country.code && <Check size={12} />}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {state.error && (
            <p role="alert" className="form-error">
              {state.error}
            </p>
          )}
          <div className="dialog-info">
            <Globe2 size={16} /> Added markets are active. You can deactivate
            them anytime.
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button button-outline"
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              className="button button-green"
              disabled={!selected || pending}
            >
              {pending ? "Adding…" : "Add selected market"}
              <Plus size={16} />
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
function MarketToggle({
  storeId,
  market,
}: {
  storeId: string;
  market: Market;
}) {
  const [state, action, pending] = useActionState(setMarketStatusAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="marketId" value={market.id} />
      <input
        type="hidden"
        name="status"
        value={market.status === "active" ? "inactive" : "active"}
      />
      <button
        className="button button-outline button-small"
        disabled={pending}
        aria-label={`${market.status === "active" ? "Deactivate" : "Activate"} ${market.countryName}`}
      >
        {pending
          ? "Updating…"
          : market.status === "active"
            ? "Deactivate"
            : "Activate"}
      </button>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
