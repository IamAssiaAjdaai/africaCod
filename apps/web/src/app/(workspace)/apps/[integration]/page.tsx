import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeading } from "@africacod/ui";
import { trackingProviders, type TrackingProvider } from "@africacod/domain";
import { requireOrganization, tracking, trackingTestMode } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { TrackingForm } from "@/components/tracking-form";
const names = {
  meta: "Meta",
  tiktok: "TikTok",
  "google-ads": "Google Ads",
  "google-sheets": "Google Sheets",
};
export default async function Integration({
  params,
  searchParams,
}: {
  params: Promise<{ integration: string }>;
  searchParams: Promise<{ storeId?: string }>;
}) {
  const { integration } = await params;
  if (!trackingProviders.includes(integration as TrackingProvider)) notFound();
  const provider = integration as TrackingProvider,
    { session } = await requireOrganization(),
    query = await searchParams,
    service = tracking(),
    stores = await service.listStores(session.user.id),
    storeId = query.storeId ?? stores[0]?.id;
  if (!storeId)
    return (
      <>
        <PageHeading
          title={names[provider]}
          description="Create a store before configuring integrations."
        />
        <Link href="/stores/new">Create store</Link>
      </>
    );
  await found(service.getStore(session.user.id, storeId));
  const health = await service.health(session.user.id, storeId, provider),
    c = health.connection,
    s = c?.settings ?? {},
    mock = trackingTestMode();
  return (
    <>
      <Link className="back-link" href={`/apps?storeId=${storeId}`}>
        ← Apps
      </Link>
      <PageHeading
        eyebrow="APPS"
        title={names[provider]}
        description="Explicit opt-in per store. Submitted COD orders are leads, never delivered revenue."
      />
      <form method="get" className="panel">
        <label>
          Store
          <select name="storeId" defaultValue={storeId}>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-outline">Select store</button>
      </form>
      <section className="panel">
        <h2>Connection</h2>
        <p>
          {mock
            ? "Deterministic test adapter — no external requests."
            : provider === "meta"
              ? "Pixel and CAPI available. Supply your Pixel ID and token, then verify reception in Meta Events Manager."
              : provider === "google-sheets"
                ? "Production blocked: Google OAuth authorization and spreadsheet access are required."
                : "Browser foundation available. Supply your own account identifiers and verify in the provider console. Server delivery conversions are deferred."}
        </p>
        <p data-testid="tracking-status">
          {c?.enabled &&
          c.lastSuccess &&
          !c.lastError &&
          (c.mode !== "mock" || mock)
            ? c.mode === "mock"
              ? "Connected (test adapter)"
              : "Connected"
            : c?.enabled && c.mode === "browser"
              ? "Configured (browser; receipt unverified)"
              : "Not connected"}
        </p>
        <TrackingForm>
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="provider" value={provider} />
          <label className="checkbox">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={c?.enabled ?? false}
            />
            Enable integration for this store
          </label>
          {(provider === "meta" || provider === "tiktok") && (
            <label>
              Pixel ID
              <input name="pixelId" defaultValue={s.pixelId ?? ""} />
            </label>
          )}
          {provider === "meta" && (
            <>
              <label>
                CAPI access token
                <input
                  name="token"
                  type="password"
                  autoComplete="off"
                  placeholder={
                    c?.hasSecret
                      ? "Saved encrypted; leave blank to retain"
                      : "Access token"
                  }
                />
              </label>
              <div>
                <label htmlFor="purchase-mode">Purchase event</label>
                <select
                  id="purchase-mode"
                  name="purchaseMode"
                  defaultValue={s.purchaseMode ?? "disabled"}
                >
                  <option value="disabled">Disabled</option>
                  <option value="delivered">On Delivered</option>
                </select>
              </div>
            </>
          )}
          {provider === "google-ads" && (
            <>
              <label>
                Google tag ID
                <input
                  name="tagId"
                  defaultValue={s.tagId ?? ""}
                  placeholder="AW-…"
                />
              </label>
              <label>
                Lead conversion label
                <input name="leadLabel" defaultValue={s.leadLabel ?? ""} />
              </label>
              <label>
                Delivered conversion label (reserved; server activation
                deferred)
                <input
                  name="deliveredLabel"
                  defaultValue={s.deliveredLabel ?? ""}
                />
              </label>
            </>
          )}
          {provider === "google-sheets" && (
            <>
              <label>
                Export destination
                <input
                  name="destination"
                  defaultValue={s.destination ?? ""}
                  placeholder={
                    mock ? "Test spreadsheet name" : "Spreadsheet ID / tab"
                  }
                />
              </label>
              <p className="muted">
                Production OAuth is deferred. No authorization is simulated
                outside test mode.
              </p>
            </>
          )}
        </TrackingForm>
      </section>
      <section className="panel">
        <h2>Integration health</h2>
        <p>Last success: {c?.lastSuccess?.toISOString() ?? "None"}</p>
        <p>Last failure: {c?.lastFailure?.toISOString() ?? "None"}</p>
        <p>Last error: {c?.lastError ?? "None"}</p>
        <p className="muted">
          Reload to inspect asynchronous updates. Logs contain safe event facts,
          never credentials or raw customer payloads.
        </p>
        <div className="table-scroll">
          <table className="markets-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {!health.events.length && (
                <tr>
                  <td colSpan={4}>
                    No integration events yet. Enable this connection, then
                    complete a relevant COD workflow.
                  </td>
                </tr>
              )}
              {health.events.map((e) => (
                <tr key={e.id}>
                  <td>{e.type}</td>
                  <td>{e.status}</td>
                  <td>{e.attempts}</td>
                  <td>
                    {e.error ??
                      [e.eventName, e.value, e.currency, e.eventId]
                        .filter((v) => v !== null && v !== undefined)
                        .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {provider === "google-sheets" && mock && (
        <section className="panel" data-testid="sheets-rows">
          <h2>Test spreadsheet rows ({health.rows.length})</h2>
          <p>One stable row per order number; updates preserve the row.</p>
          {health.rows.map((row) => (
            <article key={row.orderNumber}>
              <h3>{row.orderNumber}</h3>
              <dl>
                {Object.entries(row.columns).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
