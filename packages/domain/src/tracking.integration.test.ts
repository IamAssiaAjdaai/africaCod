import { StoreSettingsService } from "./store-settings";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import {
  createDatabase,
  visitorEvents,
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
  trackingConnections,
  commerceEvents,
  trackingJobs,
  trackingTestReceipts,
  sheetsTestRows,
  trackingAttempts,
} from "@africacod/db";
import { defaultPageConfig } from "./storefront";
import { VisitorService } from "./visitors";
import { TrackingService } from "./tracking/service";
import { AnalyticsService } from "./analytics";
import { browserEvents, leadEventId } from "./tracking/policy";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use isolated test DB");
const { db, client } = createDatabase(url);
const runtime = {
  testMode: true,
  encryptionKey: Buffer.alloc(32).toString("base64"),
};
const service = new TrackingService(db, runtime);
const analytics = new AnalyticsService(db);
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
  await new StoreSettingsService(db).publish(a, storeId, 0);
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
    await db
      .delete(trackingConnections)
      .where(eq(trackingConnections.organizationId, org));
    await db
      .delete(commerceEvents)
      .where(eq(commerceEvents.organizationId, org));
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
async function newOrder(market = "KE") {
  const receipt = await service.checkout(
    slug,
    productSlug,
    crypto.randomUUID(),
    {
      ...payload,
      market,
      phone: market === "GH" ? "0241234567" : payload.phone,
      region: market === "GH" ? "Greater Accra" : payload.region,
    },
  );
  return (
    await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, receipt.orderNumber))
  )[0];
}
const attempt = (outcome: string) => ({
  outcome,
  requestKey: crypto.randomUUID(),
});
async function drain() {
  for (let n = 0; n < 100; n++) {
    if (!(await service.runOne(orgA))) return;
  }
  throw new Error("Outbox did not drain");
}
async function setup(
  provider: "meta" | "google-sheets",
  extra: Record<string, unknown> = {},
) {
  return service.configureTracking(a, storeId, provider, {
    enabled: true,
    pixelId: "123456789",
    token: "never-return-this-token",
    purchaseMode: "delivered",
    destination: "orders-test",
    ...extra,
  });
}
async function shipment(o: typeof orders.$inferSelect) {
  await service.recordAttempt(a, o.id, attempt("confirmed"));
  await service.createFulfillment(a, o.id);
  return service.createManualShipment(a, o.id, {
    trackingNumber: "KE-TRACK-1",
  });
}
async function receipts(id: string) {
  return db
    .select()
    .from(trackingTestReceipts)
    .where(eq(trackingTestReceipts.connectionId, id));
}
describe.sequential("COD tracking, exports and analytics", () => {
  it("captures anonymous first-party observations idempotently without changing orders or revenue", async () => {
    const visitors = new VisitorService(db);
    const before = await analytics.analytics(a);
    const eventId = crypto.randomUUID();
    const input = { eventId, type: "store_view", market: "KE" };
    await visitors.capture(slug, input);
    await visitors.capture(slug, input);
    await visitors.capture(slug, {
      eventId: crypto.randomUUID(),
      type: "product_view",
      productSlug,
      market: "KE",
    });
    await visitors.capture(slug, {
      eventId: crypto.randomUUID(),
      type: "checkout_started",
      productSlug,
      market: "KE",
    });
    const rows = await visitors.observations(
      a,
      storeId,
      new Date(Date.now() - 60000),
      new Date(Date.now() + 60000),
    );
    expect(Object.fromEntries(rows.map((r) => [r.type, r.count]))).toEqual({
      store_view: 1,
      product_view: 1,
      checkout_started: 1,
    });
    expect((await analytics.analytics(a)).metrics).toEqual(before.metrics);
    const [stored] = await db
      .select()
      .from(visitorEvents)
      .where(eq(visitorEvents.id, eventId));
    expect(Object.keys(stored).sort()).toEqual(
      [
        "id",
        "organizationId",
        "storeId",
        "productId",
        "marketToken",
        "type",
        "occurredAt",
      ].sort(),
    );
    await expect(
      visitors.capture(slug, {
        ...input,
        eventId: crypto.randomUUID(),
        organizationId: orgB,
      }),
    ).rejects.toThrow();
    await expect(
      visitors.capture(slug, {
        ...input,
        eventId: crypto.randomUUID(),
        phone: "0712345678",
      }),
    ).rejects.toThrow();
    await expect(
      visitors.capture(slug, {
        ...input,
        eventId: crypto.randomUUID(),
        type: "checkout_submitted",
      }),
    ).rejects.toThrow();
    await expect(
      visitors.capture(slug, {
        ...input,
        eventId: crypto.randomUUID(),
        market: "AO",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      visitors.capture(slug, {
        eventId: crypto.randomUUID(),
        type: "product_view",
        productSlug: "unpublished",
        market: "KE",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      visitors.observations(b, storeId, new Date(0), new Date()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      db.insert(visitorEvents).values({
        id: crypto.randomUUID(),
        organizationId: orgB,
        storeId,
        productId,
        type: "product_view",
      }),
    ).rejects.toThrow();
    const oldId = crypto.randomUUID();
    await db.insert(visitorEvents).values({
      id: oldId,
      organizationId: orgA,
      storeId,
      type: "store_view",
      occurredAt: new Date(Date.now() - 31 * 86400000),
    });
    await visitors.prune();
    expect(
      await db.select().from(visitorEvents).where(eq(visitorEvents.id, oldId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(visitorEvents)
        .where(eq(visitorEvents.id, eventId)),
    ).toHaveLength(1);
  });
  it("starts disabled, enforces tenant access and encrypts secrets without returning them", async () => {
    expect(await service.publicTracking(slug)).toEqual([]);
    const c = await setup("meta", { enabled: false });
    expect(JSON.stringify(c)).not.toContain("never-return");
    expect(c.hasSecret).toBe(true);
    const [stored] = await db
      .select()
      .from(trackingConnections)
      .where(eq(trackingConnections.id, c.id));
    expect(stored.secretEncrypted).not.toContain("never-return");
    await expect(service.connection(b, storeId, "meta")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.configureTracking(b, storeId, "meta", { enabled: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.health(b, storeId, "meta")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.configureTracking(a, storeId, "tiktok", {
        enabled: true,
        pixelId: "__proto__",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(browserEvents(await service.publicTracking(slug), "view")).toEqual(
      [],
    );
  });
  it("records real product views and matches browser/server Lead IDs without premature Purchase", async () => {
    const meta = await setup("meta"),
      sheets = await setup("google-sheets");
    const connections = await service.publicTracking(slug);
    expect(browserEvents(connections, "view").map((e) => e.name)).toEqual([
      "PageView",
      "ViewContent",
    ]);
    await service.recordProductView(
      slug,
      productSlug,
      "KE",
      crypto.randomUUID(),
    );
    const o = await newOrder();
    await drain();
    const events = await receipts(meta.id);
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("Lead");
    expect(events[0].eventId).toBe(
      browserEvents(connections, "checkout", o.orderNumber)[0].eventId,
    );
    expect(events[0].payload).not.toHaveProperty("custom_data");
    const userData = events[0].payload.user_data as Record<string, unknown>;
    expect(userData.ph).toEqual([expect.stringMatching(/^[a-f0-9]{64}$/)]);
    expect(JSON.stringify(events[0].payload)).not.toContain(o.phone);
    expect(JSON.stringify(events[0].payload)).not.toContain("1200");
    const sh = await shipment(o);
    await drain();
    expect((await receipts(meta.id)).map((e) => e.eventName)).toEqual(["Lead"]);
    await service.transitionShipment(a, sh.id, "shipped");
    await drain();
    expect((await receipts(meta.id)).map((e) => e.eventName)).toEqual(["Lead"]);
    await service.updateOffer(a, offerId, {
      productId,
      storeMarketId: kenya,
      price: "4490",
      compareAtPrice: "4990",
      cost: "1200",
    });
    await service.transitionShipment(a, sh.id, "out_for_delivery");
    await service.transitionShipment(a, sh.id, "delivered");
    await drain();
    const purchase = (await receipts(meta.id)).find(
      (e) => e.eventName === "Purchase",
    )!;
    expect(purchase.payload.custom_data).toEqual({
      value: 3990,
      currency: "KES",
    });
    const rows = await db
      .select()
      .from(sheetsTestRows)
      .where(eq(sheetsTestRows.connectionId, sheets.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].columns["Shipment Status"]).toBe("delivered");
    expect(rows[0].columns["Confirmation State"]).toBe("confirmed");
    expect(rows[0].columns["Order Total"]).toBe(3990);
    expect(Object.keys(rows[0].columns).join()).not.toMatch(/cost|secret|_id/i);
    await drain();
    expect(await receipts(meta.id)).toHaveLength(2);
    expect(
      await db
        .select()
        .from(sheetsTestRows)
        .where(eq(sheetsTestRows.connectionId, sheets.id)),
    ).toHaveLength(1);
    const report = await analytics.analytics(a, { range: "today" });
    expect(report.metrics).toMatchObject({
      orders: 1,
      confirmed: 1,
      shipped: 1,
      delivered: 1,
      confirmationRate: 1,
      deliveryRate: 1,
      revenue: { KES: 399000 },
    });
    expect(report.byMarket[0].name).toBe("Kenya");
    expect(report.byProduct[0].metrics.revenue).toEqual({ KES: 399000 });
  });
  it("updates a single Sheets row after each lifecycle transition and excludes returned revenue", async () => {
    const sheets = await setup("google-sheets"),
      meta = await setup("meta", { purchaseMode: "disabled" }),
      o = await newOrder("GH");
    await drain();
    const row = () =>
      db
        .select()
        .from(sheetsTestRows)
        .where(eq(sheetsTestRows.connectionId, sheets.id));
    const created = (await row()).find((r) => r.orderNumber === o.orderNumber)!;
    expect(created.columns["Confirmation State"]).toBe("awaiting");
    const sh = await shipment(o);
    await drain();
    const confirmed = (await row()).find(
      (r) => r.orderNumber === o.orderNumber,
    )!;
    expect(confirmed.id).toBe(created.id);
    expect(confirmed.columns["Confirmation State"]).toBe("confirmed");
    await service.transitionShipment(a, sh.id, "shipped");
    await drain();
    expect(
      (await row()).find((r) => r.id === created.id)!.columns[
        "Shipment Status"
      ],
    ).toBe("shipped");
    await service.transitionShipment(a, sh.id, "returned");
    await drain();
    expect(
      (await row()).find((r) => r.id === created.id)!.columns[
        "Shipment Status"
      ],
    ).toBe("returned");
    expect(
      (await receipts(meta.id)).filter(
        (e) => e.payload.event_id === leadEventId(o.orderNumber),
      ),
    ).toHaveLength(1);
    expect(
      (await receipts(meta.id)).filter((e) => e.eventName === "Purchase"),
    ).toHaveLength(1);
    const report = await analytics.analytics(a, { range: "today" });
    expect(report.metrics).toMatchObject({
      orders: 2,
      confirmed: 2,
      shipped: 2,
      delivered: 1,
      returned: 1,
      confirmationRate: 1,
      deliveryRate: 0.5,
      revenue: { KES: 399000 },
    });
    expect(
      report.byMarket.find((m) => m.name === "Ghana")!.metrics,
    ).toMatchObject({ orders: 1, returned: 1, deliveryRate: 0, revenue: {} });
  });
  it("disabled Purchase mode emits no delivered Purchase; integration outages do not roll back delivery", async () => {
    const meta = await setup("meta", { purchaseMode: "disabled" }),
      o = await newOrder(),
      sh = await shipment(o);
    await service.transitionShipment(a, sh.id, "shipped");
    await service.transitionShipment(a, sh.id, "out_for_delivery");
    await service.transitionShipment(a, sh.id, "delivered");
    await drain();
    expect(
      (await receipts(meta.id)).filter((e) => e.eventName === "Purchase"),
    ).toHaveLength(1); // only the previous opt-in delivery
    const [stored] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.id, sh.id));
    expect(stored.status).toBe("delivered");
  });
  it("retries an accepted-but-interrupted event without duplicate Meta receipt or Sheets row", async () => {
    const meta = await setup("meta", { failOnce: true }),
      sheets = await setup("google-sheets", { failOnce: true }),
      o = await newOrder();
    await drain();
    const jobs = await db
      .select()
      .from(trackingJobs)
      .where(eq(trackingJobs.eventId, leadEventId(o.orderNumber)));
    expect(jobs.some((j) => j.safeError !== null || j.attempts >= 2)).toBe(
      true,
    );
    await db
      .update(trackingJobs)
      .set({ availableAt: new Date(0) })
      .where(eq(trackingJobs.organizationId, orgA));
    await drain();
    expect(
      (await receipts(meta.id)).filter(
        (e) => e.eventId === leadEventId(o.orderNumber),
      ),
    ).toHaveLength(1);
    expect(
      (
        await db
          .select()
          .from(sheetsTestRows)
          .where(eq(sheetsTestRows.connectionId, sheets.id))
      ).filter((r) => r.orderNumber === o.orderNumber),
    ).toHaveLength(1);
    const attempts = await db
      .select()
      .from(trackingAttempts)
      .innerJoin(trackingJobs, eq(trackingJobs.id, trackingAttempts.jobId))
      .where(eq(trackingJobs.eventId, leadEventId(o.orderNumber)));
    expect(attempts.some((a) => a.tracking_attempts.success === false)).toBe(
      true,
    );
    expect(attempts.some((a) => a.tracking_attempts.success === true)).toBe(
      true,
    );
  });
  it("enforces analytics and Sheets tenant isolation and zero-safe rates", async () => {
    expect((await analytics.analytics(b)).metrics).toMatchObject({
      orders: 0,
      confirmationRate: 0,
      deliveryRate: 0,
      revenue: {},
    });
    await expect(analytics.analytics(b, { storeId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      analytics.analytics(b, { marketId: kenya }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(analytics.analytics(b, { productId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.health(b, storeId, "google-sheets"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const filtered = await analytics.analytics(a, {
      range: "today",
      marketId: ghana,
      productId,
    });
    expect(filtered.metrics.orders).toBe(1);
    expect(filtered.metrics.revenue).toEqual({});
  });
  it("disabling a connection cancels queued work and rejects unsupported Purchase modes", async () => {
    await setup("meta");
    await newOrder();
    await service.materialize(orgA);
    await setup("meta", { enabled: false });
    await drain();
    expect(await service.publicTracking(slug)).toEqual([]);
    await expect(
      setup("meta", { purchaseMode: "submitted" }),
    ).rejects.toThrow();
    await expect(
      setup("meta", { purchaseMode: "confirmed" }),
    ).rejects.toThrow();
  });

  it("counts mixed outcomes and unconfirmed orders with explicit denominators", async () => {
    const refusedOrder = await newOrder();
    const sh = await shipment(refusedOrder);
    await service.transitionShipment(a, sh.id, "shipped");
    await service.transitionShipment(a, sh.id, "out_for_delivery");
    await service.transitionShipment(a, sh.id, "refused");
    await newOrder("GH");
    const report = await analytics.analytics(a, { range: "today" });
    expect(report.metrics).toMatchObject({
      orders: 7,
      confirmed: 4,
      shipped: 4,
      delivered: 2,
      refused: 1,
      returned: 1,
      confirmationRate: 4 / 7,
      deliveryRate: 2 / 7,
      revenue: { KES: 848000 },
    });
    expect(
      report.byMarket.find((m) => m.name === "Kenya")!.metrics.orders,
    ).toBe(5);
    expect(
      report.byMarket.find((m) => m.name === "Ghana")!.metrics,
    ).toMatchObject({ orders: 2, confirmed: 1, returned: 1, revenue: {} });
    const otherStore = await service.createStore(a, {
      name: "Other Store",
      slug: `other-${a}`,
    });
    await expect(
      db.insert(commerceEvents).values({
        id: crypto.randomUUID(),
        organizationId: orgA,
        storeId: otherStore.id,
        orderId: refusedOrder.id,
        type: "order_created",
        occurredAt: new Date(),
      }),
    ).rejects.toThrow();
    const [event] = await db
      .select()
      .from(commerceEvents)
      .where(eq(commerceEvents.organizationId, orgA))
      .limit(1);
    await expect(
      db
        .update(commerceEvents)
        .set({ type: "shipment_delivered" })
        .where(eq(commerceEvents.id, event.id)),
    ).rejects.toThrow();
  });
  it("keeps production transport separate from the deterministic adapter", async () => {
    const production = new TrackingService(db, {
      testMode: false,
      encryptionKey: runtime.encryptionKey,
    });
    const connection = await production.configureTracking(a, storeId, "meta", {
      enabled: false,
      pixelId: "123456789",
      token: "local-fake-token",
      purchaseMode: "disabled",
    });
    expect(connection.mode).toBe("production");
    expect(connection.lastSuccess).toBeNull();
    expect(JSON.stringify(connection)).not.toContain("local-fake-token");
    expect(await production.publicTracking(slug)).toEqual([]);
  });
  it("concurrent worker instances preserve unique receipts and historical commercial references", async () => {
    const connection = await setup("google-sheets");
    const o = await newOrder();
    const secondWorker = new TrackingService(db, runtime);
    await Promise.all([service.runOne(orgA), secondWorker.runOne(orgA)]);
    await drain();
    const exported = await db
      .select()
      .from(sheetsTestRows)
      .where(eq(sheetsTestRows.connectionId, connection.id));
    expect(
      exported.filter((row) => row.orderNumber === o.orderNumber),
    ).toHaveLength(1);
    await expect(
      db.delete(products).where(eq(products.id, productId)),
    ).rejects.toThrow();
    await expect(
      db.delete(storeMarkets).where(eq(storeMarkets.id, kenya)),
    ).rejects.toThrow();
    await expect(
      db.delete(productMarketOffers).where(eq(productMarketOffers.id, offerId)),
    ).rejects.toThrow();
    expect(
      (await db.select().from(orders).where(eq(orders.id, o.id)))[0]
        .orderNumber,
    ).toBe(o.orderNumber);
  });
});
