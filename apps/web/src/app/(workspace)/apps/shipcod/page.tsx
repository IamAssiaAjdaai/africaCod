import Link from "next/link";
import { PageHeading } from "@africacod/ui";
import { providers, providerTestMode, requireOrganization } from "@/lib/server";
import { found } from "@/lib/catalog-pages";
import { ProviderForm } from "@/components/provider-form";
export default async function Shipcod({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string }>;
}) {
  const { session } = await requireOrganization(),
    service = providers(),
    query = await searchParams;
  const stores = await service.listStores(session.user.id);
  const storeId = query.storeId || stores[0]?.id;
  const store = storeId
    ? await found(service.getStore(session.user.id, storeId))
    : null;
  const testMode = providerTestMode();
  const [connection, markets, products] = store
    ? await Promise.all([
        service.connectionForStore(session.user.id, store.id),
        service.listMarkets(session.user.id, store.id),
        service.listProducts(session.user.id, store.id),
      ])
    : [null, [], []];
  const [enabled, mappings] = connection
    ? await Promise.all([
        service.enabledMarkets(session.user.id, connection.id),
        service.mappings(session.user.id, connection.id),
      ])
    : [[], []];
  const variants = await Promise.all(
    products.map((p) => service.listVariants(session.user.id, p.id)),
  );
  return (
    <>
      <PageHeading
        title="ShipCOD"
        eyebrow="FULFILLMENT"
        description="Store-scoped fulfillment connection"
      />
      <p className="preview-banner">
        Production BLOCKED: official shipment API, authentication, idempotency
        and status contracts are unavailable.{" "}
        {testMode
          ? "Deterministic test adapter enabled. No requests reach ShipCOD."
          : "Test adapter disabled. Production connection unavailable."}
      </p>
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
      {store && (
        <>
          <section className="panel">
            <h2>Connection</h2>
            <p data-testid="provider-connection-status">
              {connection?.status === "connected"
                ? "Connected (test adapter)"
                : (connection?.status ?? "Not connected")}
            </p>
            <p>
              Last successful check:{" "}
              {connection?.lastSuccessAt?.toISOString() ?? "Never"}
            </p>
            {connection?.lastErrorMessage && (
              <p role="alert">{connection.lastErrorMessage}</p>
            )}
            {testMode && (
              <ProviderForm label="Save connection">
                <input type="hidden" name="intent" value="configure" />
                <input type="hidden" name="storeId" value={store.id} />
                <label>
                  API key
                  <input name="apiKey" type="password" autoComplete="off" />
                </label>
                <label>
                  API secret
                  <input name="apiSecret" type="password" autoComplete="off" />
                </label>
                <small>
                  Leave both blank to keep encrypted credentials. Test
                  credentials: mock-key / mock-secret.
                </small>
                <h3>Enabled StoreMarkets</h3>
                <p>
                  Only explicitly added active markets can be enabled. Verified
                  coverage: Kenya, Uganda, Tanzania.
                </p>
                {markets.map((m) => (
                  <label key={m.id}>
                    <input
                      type="checkbox"
                      name="marketId"
                      value={m.id}
                      defaultChecked={enabled.some((e) => e.id === m.id)}
                      disabled={
                        m.status !== "active" ||
                        !m.countryCode ||
                        !["KE", "UG", "TZ"].includes(m.countryCode)
                      }
                    />
                    {m.countryName} ({m.countryCode ?? "custom"})
                    {!m.countryCode ||
                    !["KE", "UG", "TZ"].includes(m.countryCode)
                      ? " — unsupported"
                      : ""}
                  </label>
                ))}
                <label>
                  <input
                    name="sourceTracking"
                    type="checkbox"
                    defaultChecked={connection?.settings.sourceTracking}
                  />
                  Include source tracking in test snapshot (production support
                  unverified)
                </label>
                <label>
                  <input
                    name="mockFailOnce"
                    type="checkbox"
                    defaultChecked={connection?.settings.mockFailOnce}
                  />
                  Simulate first handoff failure (test only)
                </label>
              </ProviderForm>
            )}
            {connection && testMode && (
              <>
                <ProviderForm label="Test connection">
                  <input type="hidden" name="intent" value="test" />
                  <input
                    type="hidden"
                    name="connectionId"
                    value={connection.id}
                  />
                </ProviderForm>
                <ProviderForm label="Disconnect">
                  <input type="hidden" name="intent" value="disconnect" />
                  <input
                    type="hidden"
                    name="connectionId"
                    value={connection.id}
                  />
                </ProviderForm>
              </>
            )}
            <Link
              className="text-link"
              href={`/apps/shipcod?storeId=${store.id}`}
            >
              Refresh connection
            </Link>
          </section>
          {connection && testMode && (
            <section className="panel">
              <h2>Product mappings</h2>
              <p>
                Provider identifiers are separate from your product catalog.
                Variant mappings override base product mappings.
              </p>
              {mappings.map((m) => (
                <p key={m.id}>
                  {products.find((p) => p.id === m.productId)?.name} ·{" "}
                  {m.variantId ?? "Base product"} →{" "}
                  {m.providerProductId ?? m.providerSku}
                </p>
              ))}
              <ProviderForm label="Save mapping">
                <input type="hidden" name="intent" value="mapping" />
                <input
                  type="hidden"
                  name="connectionId"
                  value={connection.id}
                />
                <label>
                  Product
                  <select name="productId" required>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Variant
                  <select name="variantId">
                    <option value="">Base product</option>
                    {variants.flatMap((vs, i) =>
                      vs.map((v) => (
                        <option key={v.id} value={v.id}>
                          {products[i].name} · {v.name}
                        </option>
                      )),
                    )}
                  </select>
                </label>
                <label>
                  Provider product ID
                  <input name="providerProductId" maxLength={120} />
                </label>
                <label>
                  Provider SKU
                  <input name="providerSku" maxLength={120} />
                </label>
              </ProviderForm>
            </section>
          )}
        </>
      )}
      {!store && <p>Create a Store first. Stores begin with zero markets.</p>}
    </>
  );
}
