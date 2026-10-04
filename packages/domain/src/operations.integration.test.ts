import { StoreSettingsService } from "./store-settings";
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
} from "@africacod/db";
import { defaultPageConfig } from "./storefront";
import { OperationsService } from "./operations";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use isolated test DB");
const { db, client } = createDatabase(url);
const service = new OperationsService(db);
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
    for (const table of [
      shipmentEvents,
      shipments,
      fulfillmentStateEvents,
      fulfillments,
      confirmationAttempts,
      orderAttribution,
      confirmationAttempts,
      fulfillments,
      fulfillmentStateEvents,
      shipments,
      shipmentEvents,
      orderEvents,
      orderItems,
      orders,
      customers,
      productPages,
      productMedia,
      productMarketOffers,
      productVariants,
      products,
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
describe.sequential(
  "Confirmation → manual fulfillment → independent Shipment",
  () => {
    it("new orders are uncontacted; no-answer attempts are retry safe", async () => {
      const o = await newOrder();
      expect((await service.getOperations(a, o.id)).confirmation).toBe(
        "uncontacted",
      );
      const input = attempt("no_answer", { note: "First call" });
      await Promise.all([
        service.recordAttempt(a, o.id, input),
        service.recordAttempt(a, o.id, input),
      ]);
      const d = await service.getOperations(a, o.id);
      expect(d.confirmation).toBe("attempted");
      expect(d.attempts).toHaveLength(1);
      await expect(
        service.recordAttempt(a, o.id, { ...input, note: "different" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("callbacks require time, expose overdue/upcoming queues, and are superseded by later attempts", async () => {
      const o = await newOrder();
      await expect(
        service.recordAttempt(a, o.id, attempt("callback")),
      ).rejects.toThrow();
      const due = new Date(Date.now() - 3600000);
      await service.recordAttempt(
        a,
        o.id,
        attempt("callback", { nextCallbackAt: due }),
      );
      let d = await service.getOperations(a, o.id);
      expect(d.confirmation).toBe("callback_due");
      expect(d.nextCallbackAt).toEqual(due);
      expect(d.callbackTiming).toBe("overdue");
      expect(
        (
          await service.listOperationalOrders(a, { callbacks: "due" })
        ).rows.some((r) => r.order.id === o.id),
      ).toBe(true);
      await service.recordAttempt(
        a,
        o.id,
        attempt("callback", { nextCallbackAt: new Date(Date.now() + 3600000) }),
      );
      d = await service.getOperations(a, o.id);
      expect(d.confirmation).toBe("attempted");
      expect(d.callbackTiming).toBe("upcoming");
      expect(
        (
          await service.listOperationalOrders(a, { callbacks: "upcoming" })
        ).rows.some((r) => r.order.id === o.id),
      ).toBe(true);
      await service.recordAttempt(a, o.id, attempt("no_answer"));
      expect((await service.getOperations(a, o.id)).nextCallbackAt).toBeNull();
      expect(
        (
          await service.listOperationalOrders(a, { callbacks: "all" })
        ).rows.some((r) => r.order.id === o.id),
      ).toBe(false);
    });
    it("confirmation is atomic, concurrent/retry-safe, and cannot be reversed", async () => {
      const o = await newOrder();
      await Promise.all([
        service.recordAttempt(a, o.id, attempt("confirmed")),
        service.recordAttempt(a, o.id, attempt("confirmed")),
      ]);
      const d = await service.getOperations(a, o.id);
      expect(d.order.status).toBe("confirmed");
      expect(d.order.confirmedAt).toBeInstanceOf(Date);
      expect(d.attempts).toHaveLength(1);
      expect(d.events.filter((e) => e.status === "confirmed")).toHaveLength(1);
      await expect(
        service.recordAttempt(
          a,
          o.id,
          attempt("cancelled", { reason: "other" }),
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(
        service.recordAttempt(a, o.id, attempt("no_answer")),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("cancellation requires a reason and keeps attempts/history", async () => {
      const o = await newOrder();
      await expect(
        service.recordAttempt(a, o.id, attempt("cancelled")),
      ).rejects.toThrow();
      await service.recordAttempt(
        a,
        o.id,
        attempt("invalid_order", {
          reason: "invalid_order",
          note: "Bad customer details",
        }),
      );
      const d = await service.getOperations(a, o.id);
      expect(d.order.status).toBe("cancelled");
      expect(d.order.cancelledAt).toBeInstanceOf(Date);
      expect(d.order.cancellationReason).toBe("invalid_order");
      expect(d.attempts[0].attempt.outcome).toBe("invalid_order");
      expect(d.events.at(-1)?.status).toBe("cancelled");
      await expect(service.createFulfillment(a, o.id)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    });
    it("assigns only members from the same organization and rejects foreign reads/actions", async () => {
      const o = await newOrder();
      const [member] = await db
        .select()
        .from(memberships)
        .where(eq(memberships.organizationId, orgA));
      const [foreign] = await db
        .select()
        .from(memberships)
        .where(eq(memberships.organizationId, orgB));
      await service.assignOrder(a, o.id, member.id);
      expect(
        (await service.getOperations(a, o.id)).order.assignedMembershipId,
      ).toBe(member.id);
      expect(
        (
          await service.listOperationalOrders(a, { agent: member.id })
        ).rows.some((r) => r.order.id === o.id),
      ).toBe(true);
      await expect(
        service.assignOrder(a, o.id, foreign.id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        db
          .update(orders)
          .set({ assignedMembershipId: foreign.id })
          .where(eq(orders.id, o.id)),
      ).rejects.toThrow();
      for (const call of [
        () => service.getOperations(b, o.id),
        () => service.recordAttempt(b, o.id, attempt("confirmed")),
        () => service.createFulfillment(b, o.id),
        () => service.assignOrder(b, o.id, foreign.id),
        () => service.getOperations(null, o.id),
      ])
        await expect(call()).rejects.toThrow();
      expect((await service.listOperationalOrders(b)).total).toBe(0);
      await service.assignOrder(a, o.id, null);
    });
    it("requires confirmed orders and creates exactly one fulfillment", async () => {
      const o = await newOrder();
      await expect(service.createFulfillment(a, o.id)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
      await expect(
        db.insert(fulfillments).values({ organizationId: orgA, orderId: o.id }),
      ).rejects.toThrow();
      await service.recordAttempt(a, o.id, attempt("confirmed"));
      const f = await service.createFulfillment(a, o.id);
      expect(f.status).toBe("ready");
      await expect(service.createFulfillment(a, o.id)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await expect(
        service.transitionFulfillment(b, o.id, "processing"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await service.transitionFulfillment(a, o.id, "processing");
      await service.transitionFulfillment(a, o.id, "failed");
      await expect(service.createManualShipment(a, o.id)).rejects.toMatchObject(
        { code: "INVALID_INPUT" },
      );
      await service.transitionFulfillment(a, o.id, "processing");
      const s = await service.createManualShipment(a, o.id, {
        trackingNumber: "MAN-1",
        trackingUrl: "https://example.com/track/MAN-1",
      });
      expect(s.providerKey).toBe("manual");
      expect((await service.getOperations(a, o.id)).fulfillment?.status).toBe(
        "fulfilled",
      );
      expect(
        (
          await service.createManualShipment(a, o.id, {
            trackingNumber: "MAN-1",
            trackingUrl: "https://example.com/track/MAN-1",
          })
        ).id,
      ).toBe(s.id);
      await expect(
        service.createManualShipment(a, o.id, { trackingNumber: "different" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        service.transitionFulfillment(a, o.id, "ready"),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("shipments require valid fulfillment, confirmed order and safe tracking URLs", async () => {
      const o = await newOrder();
      await expect(service.createManualShipment(a, o.id)).rejects.toThrow();
      await service.recordAttempt(a, o.id, attempt("confirmed"));
      await expect(service.createManualShipment(a, o.id)).rejects.toThrow();
      await service.createFulfillment(a, o.id);
      await expect(
        service.createManualShipment(a, o.id, {
          trackingUrl: "javascript:alert(1)",
        }),
      ).rejects.toThrow();
      await expect(service.createManualShipment(b, o.id)).rejects.toMatchObject(
        { code: "NOT_FOUND" },
      );
    });
    it("delivered revenue counts the order snapshot once, never submitted/confirmed/shipped value", async () => {
      const before = await service.operationalMetrics(a);
      const totalBefore = BigInt(
        before.revenue.find((r) => r.currency === "KES")?.totalMinor ?? 0,
      );
      const o = await newOrder();
      expect((await service.operationalMetrics(a)).revenue).toEqual(
        before.revenue,
      );
      await service.recordAttempt(a, o.id, attempt("confirmed"));
      expect((await service.operationalMetrics(a)).revenue).toEqual(
        before.revenue,
      );
      await service.createFulfillment(a, o.id);
      const s = await service.createManualShipment(a, o.id);
      await expect(
        service.transitionShipment(a, s.id, "delivered"),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await service.transitionShipment(a, s.id, "shipped");
      expect((await service.operationalMetrics(a)).revenue).toEqual(
        before.revenue,
      );
      await service.transitionShipment(a, s.id, "out_for_delivery");
      await service.transitionShipment(a, s.id, "delivery_failed");
      await service.transitionShipment(a, s.id, "out_for_delivery");
      await Promise.all([
        service.transitionShipment(a, s.id, "delivered"),
        service.transitionShipment(a, s.id, "delivered"),
      ]);
      const d = await service.getOperations(a, o.id);
      expect(d.order.status).toBe("confirmed");
      expect(d.shipment?.deliveredAt).toBeInstanceOf(Date);
      expect(
        d.shipmentEvents.filter((e) => e.toStatus === "delivered"),
      ).toHaveLength(1);
      const revenue = (await service.operationalMetrics(a)).revenue;
      expect(
        BigInt(revenue.find((r) => r.currency === "KES")!.totalMinor),
      ).toBe(totalBefore + BigInt(o.totalMinor));
      await service.updateOffer(a, offerId, {
        productId,
        storeMarketId: kenya,
        price: "4490",
        cost: "1200",
      });
      expect((await service.operationalMetrics(a)).revenue).toEqual(revenue);
      await expect(
        service.transitionShipment(a, s.id, "returned"),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(
        service.transitionShipment(b, s.id, "returned"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        db
          .update(shipmentEvents)
          .set({ toStatus: "returned" })
          .where(eq(shipmentEvents.shipmentId, s.id)),
      ).rejects.toThrow();
      await expect(
        db
          .update(confirmationAttempts)
          .set({ note: "Rewrite" })
          .where(eq(confirmationAttempts.orderId, o.id)),
      ).rejects.toThrow();
      await expect(
        db
          .update(orderEvents)
          .set({ message: "Rewrite" })
          .where(eq(orderEvents.orderId, o.id)),
      ).rejects.toThrow();
      await expect(
        db
          .update(fulfillmentStateEvents)
          .set({ note: "Rewrite" })
          .where(eq(fulfillmentStateEvents.orderId, o.id)),
      ).rejects.toThrow();
      expect((await service.operationalMetrics(b)).delivered).toBe(0);
    });
    it("supports refusal → return, direct shipped → returned and created → cancelled", async () => {
      for (const path of [
        ["shipped", "out_for_delivery", "refused", "returned"],
        ["shipped", "returned"],
        ["cancelled"],
      ] as const) {
        const o = await newOrder();
        await service.recordAttempt(a, o.id, attempt("confirmed"));
        await service.createFulfillment(a, o.id);
        const s = await service.createManualShipment(a, o.id);
        for (const status of path)
          await service.transitionShipment(a, s.id, status);
        const d = await service.getOperations(a, o.id);
        expect(d.order.status).toBe("confirmed");
        expect(d.shipment?.status).toBe(path.at(-1));
        expect(d.shipmentEvents).toHaveLength(path.length + 1);
        await expect(
          service.transitionShipment(a, s.id, "shipped"),
        ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      }
    });
    it("composite constraints reject foreign fulfillment/shipment/event relationships", async () => {
      const o = await newOrder();
      await service.recordAttempt(a, o.id, attempt("confirmed"));
      const f = await service.createFulfillment(a, o.id);
      await expect(
        db
          .insert(shipments)
          .values({ organizationId: orgB, orderId: o.id, fulfillmentId: f.id }),
      ).rejects.toThrow();
      await expect(
        db.insert(fulfillmentStateEvents).values({
          organizationId: orgB,
          orderId: o.id,
          fulfillmentId: f.id,
          toStatus: "ready",
        }),
      ).rejects.toThrow();
      const s = await service.createManualShipment(a, o.id);
      await expect(
        db.insert(shipmentEvents).values({
          organizationId: orgB,
          shipmentId: s.id,
          toStatus: "shipped",
        }),
      ).rejects.toThrow();
    });
  },
);
