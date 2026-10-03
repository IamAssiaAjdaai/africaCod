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
} from "@africacod/db";
import { StorefrontService, defaultPageConfig } from "./storefront";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use isolated test DB");
const { db, client } = createDatabase(url);
const service = new StorefrontService(db);
const a = crypto.randomUUID(),
  b = crypto.randomUUID();
let orgA: string,
  orgB: string,
  storeId: string,
  productId: string,
  kenya: string,
  ghana: string,
  rwanda: string,
  offerId: string,
  variantId: string;
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
let firstOrderId: string, firstCustomerId: string;
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
  rwanda = (await service.addMarket(a, { storeId, countryCode: "RW" })).id;
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
  variantId = (
    await service.createVariant(a, {
      productId,
      name: "50 ml",
      sku: "SERUM-50",
    })
  ).id;
  await service.savePageDraft(a, productId, defaultPageConfig(product, []));
});
afterAll(async () => {
  for (const org of [orgA, orgB].filter(Boolean)) {
    for (const table of [
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
describe.sequential("Published storefront and transactional COD orders", () => {
  it("draft pages cannot be read or ordered publicly", async () => {
    await expect(
      service.getPublicProduct(slug, productSlug, "KE"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.checkout(slug, productSlug, crypto.randomUUID(), payload),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await service.listOrders(a)).total).toBe(0);
  });
  it("publishes a snapshot and isolates subsequent draft edits", async () => {
    const published = await service.publishPage(a, productId);
    expect(published.publishedConfig?.headline).toBe("Hair Growth Serum");
    await service.savePageDraft(a, productId, {
      ...published.draftConfig,
      headline: "Private draft headline",
    });
    const live = await service.getPublicProduct(slug, productSlug, "KE");
    expect(live.headline).toBe("Hair Growth Serum");
    expect(
      (await service.getProductPage(a, productId))?.publishedConfig,
    ).toEqual(published.publishedConfig);
  });
  it("selects correct Kenya/Ghana prices without leaking cost or other offers", async () => {
    const ke = await service.getPublicProduct(slug, productSlug, "KE"),
      gh = await service.getPublicProduct(slug, productSlug, "GH");
    expect(ke.selected).toMatchObject({ currency: "KES", priceMinor: 399000 });
    expect(gh.selected).toMatchObject({ currency: "GHS", priceMinor: 39900 });
    expect(ke.markets.map((m) => m.token)).toEqual(["GH", "KE"]);
    const serialized = JSON.stringify(ke);
    for (const privateField of [
      "costMinor",
      "unitCost",
      "organizationId",
      "storageKey",
      orgA,
      offerId,
    ])
      expect(serialized).not.toContain(privateField);
    expect(serialized).not.toContain('"priceMinor":39900,');
  });
  it("asks for a market and never silently falls back from invalid or unconfigured markets", async () => {
    expect(
      (await service.getPublicProduct(slug, productSlug)).selected,
    ).toBeNull();
    for (const market of ["RW", "ZZ", "", `custom:missing`]) {
      const page = await service.getPublicProduct(slug, productSlug, market);
      expect(page.selected).toBeNull();
      expect(page.invalidMarket).toBe(true);
      await expect(
        service.checkout(slug, productSlug, crypto.randomUUID(), {
          ...payload,
          market,
        }),
      ).rejects.toThrow();
    }
  });
  it("excludes inactive markets/offers and automatically selects the single eligible offer", async () => {
    await service.setMarketStatus(a, {
      storeId,
      marketId: kenya,
      status: "inactive",
    });
    expect(
      (await service.getPublicProduct(slug, productSlug, "KE")).selected,
    ).toBeNull();
    expect(
      (await service.getPublicProduct(slug, productSlug)).selected?.token,
    ).toBe("GH");
    await expect(
      service.checkout(slug, productSlug, crypto.randomUUID(), payload),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await service.setMarketStatus(a, {
      storeId,
      marketId: kenya,
      status: "active",
    });
    await service.updateOffer(a, offerId, {
      productId,
      storeMarketId: kenya,
      price: "3990",
      cost: "1200",
      status: "inactive",
    });
    expect(
      (await service.getPublicProduct(slug, productSlug, "KE")).selected,
    ).toBeNull();
    await expect(
      service.checkout(slug, productSlug, crypto.randomUUID(), payload),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await service.updateOffer(a, offerId, {
      productId,
      storeMarketId: kenya,
      price: "3990",
      cost: "1200",
      status: "active",
    });
  });
  it("requires a UUID key and validates phone/address without partial writes", async () => {
    for (const changes of [
      { phone: "12345" },
      { phone: "+233241234567" },
      { region: "" },
      { city: "" },
      { address: "" },
      { variantId: crypto.randomUUID() },
    ])
      await expect(
        service.checkout(slug, productSlug, crypto.randomUUID(), {
          ...payload,
          ...changes,
        }),
      ).rejects.toThrow();
    await expect(
      service.checkout(slug, productSlug, "", payload),
    ).rejects.toThrow();
    expect(
      await db
        .select()
        .from(customers)
        .where(eq(customers.organizationId, orgA)),
    ).toHaveLength(0);
    expect((await service.listOrders(a)).total).toBe(0);
  });
  it("serializes concurrent retries into exactly one complete order, using server pricing", async () => {
    const key = crypto.randomUUID();
    const receipts = await Promise.all(
      Array.from({ length: 4 }, () =>
        service.checkout(
          slug,
          productSlug,
          key,
          { ...payload, variantId, price: 1, currency: "USD", totalMinor: 1 },
          "Test browser",
        ),
      ),
    );
    expect(new Set(receipts.map((r) => r.orderNumber)).size).toBe(1);
    expect(receipts[0]).toMatchObject({ currency: "KES", totalMinor: 399000 });
    expect(Object.keys(receipts[0]).sort()).toEqual([
      "currency",
      "orderNumber",
      "totalMinor",
    ]);
    const result = await service.listOrders(a);
    expect(result.total).toBe(1);
    firstOrderId = result.rows[0].order.id;
    firstCustomerId = result.rows[0].order.customerId;
    const detail = await service.getOrder(a, firstOrderId);
    expect(detail.items).toHaveLength(1);
    expect(detail.events).toHaveLength(1);
    expect(detail.items[0]).toMatchObject({
      unitPriceMinor: 399000,
      unitCostMinor: 120000,
      quantity: 1,
      lineTotalMinor: 399000,
      variantName: "50 ml",
      sku: "SERUM-50",
    });
    expect(detail.order).toMatchObject({
      phone: "+254712345678",
      status: "new",
      duplicateSignal: false,
    });
    expect(detail.attribution).toMatchObject({
      utmSource: "test",
      utmCampaign: "launch",
      userAgent: "Test browser",
    });
    await expect(
      service.checkout(slug, productSlug, key, {
        ...payload,
        variantId,
        quantity: 2,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await service.listOrders(a)).total).toBe(1);
  });
  it("new keys allow legitimate repeats and produce a separate duplicate signal", async () => {
    const retry = await service.checkout(
      slug,
      productSlug,
      crypto.randomUUID(),
      payload,
    );
    expect(retry.orderNumber).not.toBe(
      (await service.getOrder(a, firstOrderId)).order.orderNumber,
    );
    const rows = await service.listOrders(a);
    expect(rows.total).toBe(2);
    expect(rows.rows[0].order.duplicateSignal).toBe(true);
    expect(
      await db
        .select()
        .from(customers)
        .where(eq(customers.organizationId, orgA)),
    ).toHaveLength(1);
  });
  it("historical order/item/customer values survive product, variant and offer edits", async () => {
    const before = await service.getOrder(a, firstOrderId);
    await service.updateProduct(a, productId, {
      storeId,
      name: "Renamed serum",
      slug: productSlug,
      status: "active",
      sku: "CHANGED",
    });
    await service.updateVariant(a, variantId, {
      productId,
      name: "Renamed variant",
      sku: "NEW-SKU",
    });
    await service.updateOffer(a, offerId, {
      productId,
      storeMarketId: kenya,
      price: "4990",
      cost: "1500",
    });
    await service.checkout(slug, productSlug, crypto.randomUUID(), {
      ...payload,
      name: "Changed customer",
    });
    const after = await service.getOrder(a, firstOrderId);
    expect(after.items).toEqual(before.items);
    expect(after.order).toEqual(before.order);
    expect((await service.getCustomer(a, firstCustomerId)).name).toBe(
      "Changed customer",
    );
    expect(
      (await service.getPublicProduct(slug, productSlug, "KE")).productName,
    ).toBe("Hair Growth Serum");
  });
  it("normalizes Ghana independently and keeps currency totals separate", async () => {
    const receipt = await service.checkout(
      slug,
      productSlug,
      crypto.randomUUID(),
      {
        ...payload,
        market: "GH",
        phone: "0241234567",
        region: "Greater Accra",
        city: "Accra",
      },
    );
    expect(receipt).toMatchObject({ currency: "GHS", totalMinor: 39900 });
    const metrics = await service.orderMetrics(a);
    expect(metrics.values.map((v) => v.currency).sort()).toEqual([
      "GHS",
      "KES",
    ]);
    expect(metrics.newOrders).toBe(4);
  });
  it("enforces tenant isolation for pages/customers/orders/items/attribution and lists", async () => {
    await Promise.all(
      [
        service.getProductPage(b, productId),
        service.savePageDraft(b, productId, { headline: "Stolen" }),
        service.publishPage(b, productId),
        service.getCustomer(b, firstCustomerId),
        service.getOrder(b, firstOrderId),
      ].map((operation) =>
        expect(operation).rejects.toMatchObject({ code: "NOT_FOUND" }),
      ),
    );
    expect((await service.listOrders(b)).total).toBe(0);
    await expect(service.listOrders(b, { storeId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      db
        .update(orders)
        .set({ storeMarketId: rwanda })
        .where(eq(orders.id, firstOrderId)),
    ).rejects.toThrow();
    await expect(
      db
        .update(orderItems)
        .set({ organizationId: orgB })
        .where(eq(orderItems.orderId, firstOrderId)),
    ).rejects.toThrow();
  });
  it("supports order search/status/date pagination and safe unpublishing", async () => {
    expect(
      (
        await service.listOrders(a, {
          search: "Jane Kenyan",
          storeId,
          marketId: kenya,
          status: "new",
        })
      ).total,
    ).toBe(2);
    expect((await service.listOrders(a, { page: 2 })).rows).toEqual([]);
    expect(
      (await service.listOrders(a, { dateFrom: "2099-01-01" })).total,
    ).toBe(0);
    const key = crypto.randomUUID();
    const receipt = await service.checkout(slug, productSlug, key, payload);
    await service.unpublishPage(a, productId);
    await expect(
      service.getPublicProduct(slug, productSlug, "KE"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await service.checkout(slug, productSlug, key, payload)).toEqual(
      receipt,
    );
    await expect(
      service.checkout(slug, productSlug, crypto.randomUUID(), payload),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("publishes ordered media snapshots and protects live files from draft deletion", async () => {
    const files = new Map<string, Uint8Array>();
    const storage = {
      async put(key: string, bytes: Uint8Array) {
        files.set(key, bytes);
      },
      async read(key: string) {
        return files.get(key)!;
      },
      async remove(key: string) {
        files.delete(key);
      },
    };
    const png = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const first = await service.uploadMedia(
      a,
      { productId, altText: "First bottle" },
      png,
      "image/png",
      storage,
    );
    const second = await service.uploadMedia(
      a,
      { productId, altText: "Second bottle" },
      png,
      "image/png",
      storage,
    );
    const config = (await service.getProductPage(a, productId))!.draftConfig;
    await service.savePageDraft(a, productId, {
      ...config,
      mediaIds: [second.id, first.id],
    });
    await service.publishPage(a, productId);
    expect(
      (await service.getPublicProduct(slug, productSlug, "KE")).media.map(
        (m) => m.altText,
      ),
    ).toEqual(["Second bottle", "First bottle"]);
    await service.savePageDraft(a, productId, {
      ...config,
      mediaIds: [first.id],
    });
    await expect(
      service.removeMedia(a, second.id, storage),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(files.has(second.storageKey)).toBe(true);
    expect(
      (await service.getPublicMedia(slug, productSlug, second.id)).altText,
    ).toBe("Second bottle");
    await service.publishPage(a, productId);
    await service.removeMedia(a, second.id, storage);
    await expect(
      service.getPublicMedia(slug, productSlug, second.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("inactive products and stores cannot be publicly read or ordered", async () => {
    await db
      .update(products)
      .set({ status: "draft" })
      .where(eq(products.id, productId));
    await expect(
      service.getPublicProduct(slug, productSlug, "KE"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.checkout(slug, productSlug, crypto.randomUUID(), payload),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db
      .update(products)
      .set({ status: "active" })
      .where(eq(products.id, productId));
    await db
      .update(stores)
      .set({ status: "inactive" })
      .where(eq(stores.id, storeId));
    await expect(
      service.getPublicProduct(slug, productSlug, "KE"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.checkout(slug, productSlug, crypto.randomUUID(), payload),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db
      .update(stores)
      .set({ status: "active" })
      .where(eq(stores.id, storeId));
  });
});
