import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import {
  createDatabase,
  seedCountries,
  user,
  organizations,
  memberships,
  stores,
  storeMarkets,
  products,
  productPages,
  productMarketOffers,
  productVariants,
  productMedia,
  customers,
  orders,
  orderItems,
  orderEvents,
  orderAttribution,
  confirmationAttempts,
  fulfillments,
  fulfillmentStateEvents,
  shipments,
  shipmentEvents,
  providerConnections,
  providerConnectionMarkets,
  providerProductMappings,
  providerJobs,
  providerAttempts,
  providerStatusEvents,
  providerTestShipments,
} from "@africacod/db";
import { defaultPageConfig } from "./storefront";
import { ProviderService } from "./integrations/service";
import { DatabaseMockRemote } from "./integrations/mock-remote";
import { CredentialVault } from "./integrations/credentials";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use isolated test DB");
const { db, client } = createDatabase(url);
const runtime = {
  testMode: true,
  encryptionKey: Buffer.alloc(32).toString("base64"),
};
const service = new ProviderService(db, runtime);
let connectionId: string;
const a = crypto.randomUUID(),
  b = crypto.randomUUID();
let orgA: string,
  orgB: string,
  storeId: string,
  productId: string,
  kenya: string,
  ghana: string,
  offerId: string;
const slug = `glow-${a}`,
  productSlug = "hair-growth-serum";
const payload = {
  market: "KE",
  name: "Jane Kenyan",
  phone: "0712345678",
  region: "Nairobi",
  city: "Nairobi",
  address: "12 Garden Road",
  quantity: 1,
  attribution: {
    utmSource: "test",
    utmCampaign: "launch",
    landingUrl: "https://example.com/?market=KE",
  },
};

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../../db/drizzle", import.meta.url),
    ),
  });
  await seedCountries(db);
  await db.insert(user).values(
    [a, b].map((id) => ({
      id,
      name: "Storefront test",
      email: `${id}@example.com`,
    })),
  );
  orgA = (await service.createOrganization(a, { name: "Storefront A" })).id;
  orgB = (await service.createOrganization(b, { name: "Storefront B" })).id;
  const store = await service.createStore(a, { name: "Glow Beauty", slug });
  storeId = store.id;
  kenya = (await service.addMarket(a, { storeId, countryCode: "KE" })).id;
  ghana = (await service.addMarket(a, { storeId, countryCode: "GH" })).id;
  await service.addMarket(a, { storeId, countryCode: "RW" });
  const product = await service.createProduct(a, {
    storeId,
    name: "Hair Growth Serum",
    slug: productSlug,
    sku: "SERUM-001",
    status: "active",
  });
  productId = product.id;
  offerId = (
    await service.createOffer(a, {
      productId,
      storeMarketId: kenya,
      price: "3990",
      compareAtPrice: "4990",
      cost: "1200",
    })
  ).id;
  await service.createOffer(a, {
    productId,
    storeMarketId: ghana,
    price: "399",
    cost: "120",
  });
  await service.createVariant(a, { productId, name: "50 ml", sku: "SERUM-50" });
  await service.savePageDraft(a, productId, defaultPageConfig(product, []));
  await service.publishPage(a, productId);
});
afterAll(async () => {
  for (const org of [orgA, orgB].filter(Boolean)) {
    const connections = await db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.organizationId, org));
    for (const c of connections)
      await db
        .delete(providerTestShipments)
        .where(eq(providerTestShipments.connectionId, c.id));
    for (const table of [
      providerStatusEvents,
      providerAttempts,
      providerJobs,
      providerProductMappings,
      providerConnectionMarkets,
      shipmentEvents,
      shipments,
      fulfillmentStateEvents,
      fulfillments,
      confirmationAttempts,
      orderAttribution,
      orderEvents,
      orderItems,
      orders,
      customers,
      productPages,
      productMedia,
      productMarketOffers,
      productVariants,
      products,
      providerConnections,
      storeMarkets,
      stores,
      memberships,
    ])
      await db.delete(table).where(eq(table.organizationId, org));
    await db.delete(organizations).where(eq(organizations.id, org));
  }
  await db.delete(user).where(eq(user.id, a));
  await db.delete(user).where(eq(user.id, b));
  await client.end();
});
async function newOrder() {
  const receipt = await service.checkout(
    slug,
    productSlug,
    crypto.randomUUID(),
    payload,
  );
  return (
    await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, receipt.orderNumber))
  )[0];
}
const attempt = (outcome: string, extra: Record<string, unknown> = {}) => ({
  outcome,
  requestKey: crypto.randomUUID(),
  ...extra,
});
async function configure(extra: Record<string, unknown> = {}) {
  connectionId = await service.configure(a, storeId, {
    apiKey: "mock-key",
    apiSecret: "mock-secret",
    marketIds: [kenya],
    ...extra,
  });
  await service.testConnection(a, connectionId);
  await service.runOne();
  return connectionId;
}
async function confirmed() {
  const o = await newOrder();
  await service.recordAttempt(a, o.id, attempt("confirmed"));
  await service.createFulfillment(a, o.id);
  return o;
}
async function handoff() {
  const o = await confirmed();
  await service.requestHandoff(a, o.id);
  await service.runOne();
  return (await service.getOperations(a, o.id)).shipment!;
}
describe.sequential("Provider fulfillment framework", () => {
  it("uses reference countries without automatically adding StoreMarkets", async () => {
    const before = await service.listMarkets(a, storeId);
    await configure();
    expect(await service.listMarkets(a, storeId)).toEqual(before);
    expect(before.map((m) => m.countryCode).sort()).toEqual(["GH", "KE", "RW"]);
    const safe = await service.connection(a, connectionId);
    const [row] = await db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, connectionId));
    expect(row.credentialsEncrypted).not.toContain("mock-key");
    expect(row.credentialsEncrypted).not.toContain("mock-secret");
    expect(JSON.stringify(safe)).not.toContain("credentials");
    expect(safe.status).toBe("connected");
    expect(await service.enabledMarkets(a, connectionId)).toHaveLength(1);
  });
  it("rejects invalid credentials without returning or logging secrets", async () => {
    await configure({
      apiKey: "bad-key",
      apiSecret: "sensitive-invalid-secret",
    });
    const c = await service.connection(a, connectionId);
    expect(c.status).toBe("error");
    expect(c.lastErrorMessage).toBe("Provider credentials were rejected.");
    const attempts = await db
      .select()
      .from(providerAttempts)
      .where(eq(providerAttempts.connectionId, connectionId));
    expect(attempts.at(-1)?.success).toBe(false);
    expect(JSON.stringify(attempts)).not.toContain("sensitive");
    await configure();
  });
  it("rejects unsupported Ghana without restricting generic StoreMarkets", async () => {
    await expect(
      service.configure(a, storeId, {
        apiKey: "mock-key",
        apiSecret: "mock-secret",
        marketIds: [ghana],
      }),
    ).rejects.toThrow("supported");
    expect(
      (await service.listMarkets(a, storeId)).some(
        (m) => m.countryCode === "GH",
      ),
    ).toBe(true);
  });
  it("cannot hand off new orders or confirmed orders with missing mappings", async () => {
    const o = await newOrder();
    await expect(service.requestHandoff(a, o.id)).rejects.toThrow();
    expect((await service.integrationDetails(a, o.id)).jobs).toHaveLength(0);
    await service.recordAttempt(a, o.id, attempt("confirmed"));
    await service.createFulfillment(a, o.id);
    await expect(service.requestHandoff(a, o.id)).rejects.toThrow();
    await service.saveMapping(a, connectionId, {
      productId,
      variantId: null,
      providerProductId: "fixture-serum",
      providerSku: "TEST-SERUM",
    });
  });
  it("enqueues before worker runs and snapshots original checkout values", async () => {
    const o = await confirmed();
    const j = await service.requestHandoff(a, o.id);
    expect(j.status).toBe("pending");
    expect(j.snapshot?.totalMinor).toBe(399000);
    expect((await service.getOperations(a, o.id)).shipment).toBeNull();
    await service.updateOffer(a, offerId, {
      productId,
      storeMarketId: kenya,
      price: "5000",
      compareAtPrice: "6000",
      cost: "1200",
    });
    expect((await service.requestHandoff(a, o.id)).id).toBe(j.id);
    await service.runOne();
    const detail = await service.getOperations(a, o.id);
    expect(detail.shipment?.providerKey).toBe("shipcod");
    expect(detail.shipment?.providerShipmentId).toContain("test-shipcod-");
    expect(detail.fulfillment?.status).toBe("fulfilled");
    expect(detail.order.status).toBe("confirmed");
    expect(detail.order.totalMinor).toBe(399000);
    await service.updateOffer(a, offerId, {
      productId,
      storeMarketId: kenya,
      price: "3990",
      compareAtPrice: "4990",
      cost: "1200",
    });
  });
  it("recovers a worker crash with the same remote idempotency key and exactly one shipment", async () => {
    const o = await confirmed(),
      j = await service.requestHandoff(a, o.id);
    const [c] = await db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, connectionId));
    const credentials = new CredentialVault(runtime.encryptionKey).decrypt(
      c.credentialsEncrypted,
      `${c.organizationId}:${c.storeId}:${c.id}:shipcod`,
    );
    expect(credentials.apiKey).toBe("mock-key");
    const remote = new DatabaseMockRemote(db, connectionId);
    await remote.create(j.fulfillmentId!, false);
    await db
      .update(providerJobs)
      .set({ status: "processing", leaseUntil: new Date(Date.now() - 1000) })
      .where(eq(providerJobs.id, j.id));
    await service.runOne();
    const data = await service.getOperations(a, o.id);
    expect(data.shipmentEvents).toHaveLength(1);
    expect(
      (
        await db
          .select()
          .from(providerTestShipments)
          .where(eq(providerTestShipments.requestKey, j.fulfillmentId!))
      )[0].calls,
    ).toBe(2);
    expect(
      await db
        .select()
        .from(shipments)
        .where(eq(shipments.fulfillmentId, j.fulfillmentId!)),
    ).toHaveLength(1);
  });
  it("known polling transitions produce delivery revenue once; duplicate events and terminal sync are safe", async () => {
    const s = await handoff();
    for (const raw of [
      "mock_shipped",
      "mock_out_for_delivery",
      "mock_delivered",
    ]) {
      await service.simulateStatus(a, s.id, raw);
      await service.runOne();
    }
    const d = await service.getOperations(a, s.orderId);
    expect(d.shipment?.status).toBe("delivered");
    expect(d.order.status).toBe("confirmed");
    expect(d.shipmentEvents).toHaveLength(4);
    expect(await service.requestSync(a, s.id)).toBeNull();
    const metric = await service.operationalMetrics(a);
    expect(metric.revenue.find((r) => r.currency === "KES")?.totalMinor).toBe(
      "399000",
    );
  });
  it("deduplicates a nonterminal provider event and preserves unknown or invalid statuses for investigation", async () => {
    const s = await handoff();
    await service.simulateStatus(a, s.id, "mock_shipped");
    await service.runOne();
    await service.requestSync(a, s.id);
    await service.runOne();
    expect(
      (await service.getOperations(a, s.orderId)).shipmentEvents,
    ).toHaveLength(2);
    await service.simulateStatus(a, s.id, "mock_unknown");
    await service.runOne();
    let d = await service.getOperations(a, s.orderId);
    expect(d.shipment?.status).toBe("shipped");
    expect(d.shipment?.providerRawStatus).toBe("mock_unknown");
    expect(
      (await service.integrationDetails(a, s.orderId)).jobs.find(
        (j) => j.operation === "poll",
      )?.status,
    ).toBe("investigation");
    await service.simulateStatus(a, s.id, "mock_delivered");
    await service.runOne();
    d = await service.getOperations(a, s.orderId);
    expect(d.shipment?.status).toBe("shipped");
    expect(d.shipment?.integrationError).toContain("state machine");
    const events = await db
      .select()
      .from(providerStatusEvents)
      .where(eq(providerStatusEvents.shipmentId, s.id));
    expect(events.map((e) => e.disposition)).toContain("unknown");
    await expect(
      db
        .update(providerStatusEvents)
        .set({ rawStatus: "corrupt" })
        .where(eq(providerStatusEvents.id, events[0].id)),
    ).rejects.toThrow();
    await expect(
      service.transitionShipment(a, s.id, "out_for_delivery"),
    ).rejects.toThrow();
    await expect(
      service.transitionFulfillment(a, s.orderId, "failed"),
    ).rejects.toThrow();
  });
  it("records failed attempts and can retry without duplicate remote shipments", async () => {
    await configure({ mockFailOnce: true });
    const o = await confirmed();
    const j = await service.requestHandoff(a, o.id);
    await service.runOne();
    expect(
      (await service.integrationDetails(a, o.id)).jobs.find(
        (j) => j.operation === "create",
      )?.status,
    ).toBe("failed");
    expect((await service.getOperations(a, o.id)).fulfillment?.status).toBe(
      "failed",
    );
    expect(
      (
        await db
          .select()
          .from(providerAttempts)
          .where(eq(providerAttempts.jobId, j.id))
      )[0].success,
    ).toBe(false);
    expect((await service.requestHandoff(a, o.id)).id).toBe(j.id);
    await service.runOne();
    expect(
      await db.select().from(shipments).where(eq(shipments.orderId, o.id)),
    ).toHaveLength(1);
  });
  it("cancels a failed handoff before manual fallback and preserves confirmed Order", async () => {
    const o = await confirmed();
    await service.requestHandoff(a, o.id);
    await service.runOne();
    await service.manualFallback(a, o.id);
    const s = await service.createManualShipment(a, o.id, {
      trackingNumber: "MANUAL-RECOVERY",
      trackingUrl: null,
    });
    expect(s.providerKey).toBe("manual");
    expect((await service.getOperations(a, o.id)).order.status).toBe(
      "confirmed",
    );
    expect(
      (await service.integrationDetails(a, o.id)).jobs.find(
        (j) => j.operation === "create",
      )?.status,
    ).toBe("cancelled");
    await configure();
  });
  it("enforces cross-tenant read edit use trigger mapping and status isolation", async () => {
    const s = await handoff();
    for (const operation of [
      () => service.connection(b, connectionId),
      () => service.configure(b, storeId, { marketIds: [] }),
      () => service.testConnection(b, connectionId),
      () => service.disconnect(b, connectionId),
      () =>
        service.saveMapping(b, connectionId, { productId, providerSku: "x" }),
      () => service.requestHandoff(b, s.orderId),
      () => service.requestSync(b, s.id),
      () => service.simulateStatus(b, s.id, "mock_shipped"),
    ])
      await expect(operation()).rejects.toThrow();
    await service.disconnect(a, connectionId);
    const o = await confirmed();
    await expect(service.requestHandoff(a, o.id)).rejects.toThrow();
    expect(
      (
        await service.createManualShipment(a, o.id, {
          trackingNumber: null,
          trackingUrl: null,
        })
      ).providerKey,
    ).toBe("manual");
  });
  it("production cannot configure or silently use test credentials", async () => {
    const production = new ProviderService(db, { ...runtime, testMode: false });
    await expect(
      production.configure(a, storeId, {
        apiKey: "mock-key",
        apiSecret: "mock-secret",
        marketIds: [kenya],
      }),
    ).rejects.toThrow("blocked");
  });
});
