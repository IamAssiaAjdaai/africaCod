import { createHash } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "@africacod/db";
import { StoreSettingsService } from "./store-settings";
import { ContentService } from "./content";
import { OperationsService } from "./operations";
import { DashboardService } from "./dashboard";
import { defaultPageConfig } from "./storefront";
import type { StoreSettings } from "@africacod/validation";
const url = process.env.TEST_DATABASE_URL!;
if (!new URL(url).pathname.endsWith("_test"))
  throw new Error("Use isolated test DB");
const { db, client } = schema.createDatabase(url);
const settings = new StoreSettingsService(db),
  content = new ContentService(db),
  ops = new OperationsService(db),
  dashboard = new DashboardService(db);
const a = crypto.randomUUID(),
  b = crypto.randomUUID();
let orgA: string, orgB: string;
const payload = {
  market: "KE",
  name: "Jane Kenyan",
  phone: "0712345678",
  region: "Nairobi",
  city: "Nairobi",
  address: "12 Garden Road",
  quantity: 1,
};
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../../db/drizzle", import.meta.url),
    ),
  });
  await schema.seedCountries(db);
  await db.insert(schema.user).values(
    [a, b].map((id) => ({
      id,
      name: "Settings Merchant",
      email: `${id}@example.com`,
    })),
  );
  orgA = (await settings.createOrganization(a, { name: "Settings A" })).id;
  orgB = (await settings.createOrganization(b, { name: "Settings B" })).id;
});
afterAll(async () => {
  for (const org of [orgA, orgB]) {
    if (!org) continue;
    for (const table of [
      schema.commerceEvents,
      schema.visitorEvents,
      schema.shipmentEvents,
      schema.shipments,
      schema.fulfillmentStateEvents,
      schema.fulfillments,
      schema.confirmationAttempts,
      schema.orderAttribution,
      schema.orderEvents,
      schema.orderItems,
      schema.orders,
      schema.customers,
      schema.contentPages,
      schema.productPages,
      schema.productMarketOffers,
      schema.productVariants,
      schema.productMedia,
      schema.products,
      schema.categories,
      schema.storeAssets,
      schema.storeMarkets,
      schema.stores,
      schema.memberships,
    ])
      await db.delete(table).where(eq(table.organizationId, org));
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, org));
  }
  await db.delete(schema.user).where(eq(schema.user.id, a));
  await db.delete(schema.user).where(eq(schema.user.id, b));
  await client.end();
});
async function fixture(owner = a) {
  const store = await settings.createStore(owner, {
    name: "Glow Beauty",
    slug: `settings-${crypto.randomUUID()}`,
  });
  const market = await settings.addMarket(owner, {
    storeId: store.id,
    countryCode: "KE",
  });
  const product = await settings.createProduct(owner, {
    storeId: store.id,
    name: "Hair Growth Serum",
    slug: "hair-growth-serum",
    status: "active",
  });
  const offer = await settings.createOffer(owner, {
    productId: product.id,
    storeMarketId: market.id,
    price: "3990",
  });
  await ops.savePageDraft(owner, product.id, defaultPageConfig(product, []));
  await ops.publishPage(owner, product.id);
  return { store, market, product, offer };
}
async function configure(
  id: string,
  change: (s: StoreSettings) => void,
  publish = true,
) {
  const current = await settings.settings(a, id);
  const draft = structuredClone(current.draft);
  change(draft);
  const saved = await settings.saveDraft(a, id, draft, current.revision);
  return publish ? settings.publish(a, id, saved.revision) : saved;
}
async function checkout(
  f: Awaited<ReturnType<typeof fixture>>,
  value: unknown = payload,
) {
  const r = await ops.checkout(
    f.store.slug,
    f.product.slug,
    crypto.randomUUID(),
    value,
  );
  return (
    await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.orderNumber, r.orderNumber))
  )[0];
}
describe("Store draft publication and checkout boundaries", () => {
  it("new Store starts with valid Draft and zero Markets", async () => {
    const store = await settings.createStore(a, {
      name: "Zero Store",
      slug: `zero-${crypto.randomUUID()}`,
    });
    const s = await settings.settings(a, store.id);
    expect(s.draft.theme.color).toBe("#147d64");
    expect(s.revision).toBe(0);
    expect(await settings.listMarkets(a, store.id)).toEqual([]);
  });
  it("Draft edits appear only in authenticated preview; publication updates one coherent snapshot", async () => {
    const f = await fixture();
    const saved = await configure(
      f.store.id,
      (s) => {
        s.identity.name = "Draft Brand";
        s.theme.color = "#993355";
        s.hero.enabled = true;
        s.hero.title = "Draft Hero";
      },
      false,
    );
    expect((await content.getPublicStore(f.store.slug)).name).toBe(
      "Glow Beauty",
    );
    expect((await content.getPublicStore(f.store.slug, a)).name).toBe(
      "Draft Brand",
    );
    expect(
      (await ops.getPublicProduct(f.store.slug, f.product.slug, "KE")).settings
        .theme.color,
    ).toBe("#147d64");
    await settings.publish(a, f.store.id, saved.revision);
    const live = await content.getPublicStore(f.store.slug);
    expect(live.name).toBe("Draft Brand");
    expect(live.settings.theme.color).toBe("#993355");
    expect((await settings.settings(a, f.store.id)).publishedAt).toBeInstanceOf(
      Date,
    );
  });
  it("Draft custom fields cannot enter public checkout before publication", async () => {
    const f = await fixture();
    const id = crypto.randomUUID();
    await configure(
      f.store.id,
      (s) => {
        s.productPage.customFields = [
          {
            id,
            label: "Draft only",
            type: "text",
            enabled: true,
            required: true,
            order: 7,
            options: [],
          },
        ];
      },
      false,
    );
    expect(
      (await ops.getPublicProduct(f.store.slug, f.product.slug, "KE")).settings
        .productPage.customFields,
    ).toEqual([]);
    await expect(
      checkout(f, { ...payload, customFields: { [id]: "Draft value" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await checkout(f)).customFieldSnapshots).toEqual([]);
  });
  it("featured Category includes its subcategory products and hides an inactive category", async () => {
    const f = await fixture();
    const parent = await settings.createCategory(a, {
      storeId: f.store.id,
      name: "Beauty",
      slug: "beauty",
    });
    const category = await settings.createCategory(a, {
      storeId: f.store.id,
      name: "Hair",
      slug: "hair",
      parentId: parent.id,
    });
    await db
      .update(schema.products)
      .set({ categoryId: parent.id, subcategoryId: category.id })
      .where(eq(schema.products.id, f.product.id));
    await configure(f.store.id, (s) => {
      s.featured = {
        enabled: true,
        title: "Hair care",
        mode: "category",
        categoryId: category.id,
        productIds: [],
      };
    });
    expect(
      (
        await content.browseStore(
          f.store.slug,
          "KE",
          undefined,
          1,
          undefined,
          true,
        )
      ).products,
    ).toHaveLength(1);
    await db
      .update(schema.categories)
      .set({ status: "inactive" })
      .where(eq(schema.categories.id, category.id));
    expect(
      (
        await content.browseStore(
          f.store.slug,
          "KE",
          undefined,
          1,
          undefined,
          true,
        )
      ).products,
    ).toHaveLength(0);
  });
  it("stale saves and stale publishes cannot overwrite newer Draft", async () => {
    const f = await fixture();
    await configure(
      f.store.id,
      (s) => {
        s.hero.title = "New";
      },
      false,
    );
    await expect(
      settings.saveDraft(a, f.store.id, f.store.draftSettings, 0),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(settings.publish(a, f.store.id, 0)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(
      (await content.getPublicStore(f.store.slug)).settings.hero.title,
    ).toBe("");
  });
  it("invalid color is rejected without altering Draft", async () => {
    const f = await fixture();
    await expect(
      configure(f.store.id, (s) => {
        s.theme.color = "red";
      }),
    ).rejects.toThrow();
    expect((await settings.settings(a, f.store.id)).revision).toBe(0);
  });
  it("disabled announcement and Hero remain disabled publicly", async () => {
    const f = await fixture();
    await configure(f.store.id, (s) => {
      s.announcement.text = "Private disabled text";
      s.hero.title = "Disabled Hero";
    });
    const live = await content.getPublicStore(f.store.slug);
    expect(live.settings.announcement.enabled).toBe(false);
    expect(live.settings.hero.enabled).toBe(false);
  });
  it("Draft CMS navigation cannot publish, and failed publication preserves prior snapshot", async () => {
    const f = await fixture();
    await configure(f.store.id, (s) => {
      s.theme.color = "#003344";
    });
    const page = await content.saveContentPage(a, null, {
      storeId: f.store.id,
      title: "Draft About",
      slug: "about",
      content: "Story",
    });
    const saved = await configure(
      f.store.id,
      (s) => {
        s.theme.color = "#aabbcc";
        s.navigation.header = [
          {
            id: crypto.randomUUID(),
            label: "About",
            target: { kind: "page", id: page.id },
          },
        ];
      },
      false,
    );
    await expect(
      settings.publish(a, f.store.id, saved.revision),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(
      (await content.getPublicStore(f.store.slug)).settings.theme.color,
    ).toBe("#003344");
    await content.publishContentPage(a, page.id);
    await settings.publish(a, f.store.id, saved.revision);
    expect(
      (await content.getPublicStore(f.store.slug)).settings.navigation.header[0]
        .url,
    ).toContain("/pages/about");
    await content.unpublishContentPage(a, page.id);
    expect(
      (await content.getPublicStore(f.store.slug)).settings.navigation.header,
    ).toEqual([]);
  });
  it("featured products remain Market-aware and exclude inactive offers and products", async () => {
    const f = await fixture();
    await settings.addMarket(a, { storeId: f.store.id, countryCode: "GH" });
    await configure(f.store.id, (s) => {
      s.featured = {
        enabled: true,
        title: "Selected",
        mode: "manual",
        categoryId: null,
        productIds: [f.product.id],
      };
    });
    expect(
      (
        await content.browseStore(
          f.store.slug,
          "KE",
          undefined,
          1,
          undefined,
          true,
        )
      ).products,
    ).toHaveLength(1);
    expect(
      (
        await content.browseStore(
          f.store.slug,
          "GH",
          undefined,
          1,
          undefined,
          true,
        )
      ).products,
    ).toHaveLength(0);
    await db
      .update(schema.productMarketOffers)
      .set({ status: "inactive" })
      .where(eq(schema.productMarketOffers.id, f.offer.id));
    expect(
      (
        await content.browseStore(
          f.store.slug,
          "KE",
          undefined,
          1,
          undefined,
          true,
        )
      ).products,
    ).toHaveLength(0);
    await db
      .update(schema.productMarketOffers)
      .set({ status: "active" })
      .where(eq(schema.productMarketOffers.id, f.offer.id));
    await db
      .update(schema.products)
      .set({ status: "archived" })
      .where(eq(schema.products.id, f.product.id));
    expect(
      (
        await content.browseStore(
          f.store.slug,
          "KE",
          undefined,
          1,
          undefined,
          true,
        )
      ).products,
    ).toHaveLength(0);
  });
  it("light/dark logos are Store-owned, private until publish, and replaced live media stays safe", async () => {
    const f = await fixture();
    const other = await fixture();
    const storage = {
      async put() {},
      async read() {
        return new Uint8Array();
      },
      async remove() {},
    };
    const png = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const light = await settings.uploadAsset(
        a,
        f.store.id,
        png,
        "image/png",
        storage,
      ),
      dark = await settings.uploadAsset(
        a,
        f.store.id,
        png,
        "image/png",
        storage,
      );
    await configure(
      f.store.id,
      (s) => {
        s.identity.logoLight = light.id;
        s.identity.logoDark = dark.id;
      },
      false,
    );
    await expect(
      settings.publicAsset(f.store.slug, light.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      settings.privateAsset(a, other.store.id, light.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const saved = await settings.settings(a, f.store.id);
    await settings.publish(a, f.store.id, saved.revision);
    expect((await settings.publicAsset(f.store.slug, dark.id)).storeId).toBe(
      f.store.id,
    );
    // Legacy logo metadata must not bypass the Published asset allowlist.
    await db
      .update(schema.stores)
      .set({
        logo: (await settings.privateAsset(a, f.store.id, light.id)).storageKey,
      })
      .where(eq(schema.stores.id, f.store.id));
    await configure(f.store.id, (s) => {
      s.identity.logoDark = null;
      s.identity.logoLight = null;
    });
    await expect(content.getPublicLogo(f.store.slug)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      settings.publicAsset(f.store.slug, dark.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("cross-tenant settings, preview and resources are rejected", async () => {
    const f = await fixture(),
      foreign = await fixture(b);
    await Promise.all(
      [
        settings.settings(b, f.store.id),
        settings.saveDraft(b, f.store.id, f.store.draftSettings, 0),
        settings.publish(b, f.store.id, 0),
        content.getPublicStore(f.store.slug, b),
      ].map((request) =>
        expect(request).rejects.toMatchObject({ code: "NOT_FOUND" }),
      ),
    );
    await expect(
      configure(f.store.id, (s) => {
        s.featured.productIds = [foreign.product.id];
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("preserves Checkpoint 9 idempotency hashes after the additive settings migration", async () => {
    const f = await fixture();
    const order = await checkout(f);
    const legacyHash = createHash("sha256")
      .update(
        JSON.stringify({
          productId: f.product.id,
          marketId: f.market.id,
          variantId: null,
          quantity: payload.quantity,
          name: payload.name,
          phone: order.phone,
          region: payload.region,
          city: payload.city,
          address: payload.address,
        }),
      )
      .digest("hex");
    expect(order.requestHash).toBe(legacyHash);
    expect(
      await ops.checkout(
        f.store.slug,
        f.product.slug,
        order.checkoutIdempotencyKey,
        payload,
      ),
    ).toMatchObject({ orderNumber: order.orderNumber });
    await expect(
      ops.checkout(f.store.slug, f.product.slug, order.checkoutIdempotencyKey, {
        ...payload,
        notes: "New delivery instructions",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("custom Text, Textarea and Select snapshot original labels and values", async () => {
    const f = await fixture();
    const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    await configure(f.store.id, (s) => {
      s.productPage.customFields = (
        ["text", "textarea", "select"] as const
      ).map((type, i) => ({
        id: ids[i],
        label: `Original ${type}`,
        type,
        enabled: true,
        required: true,
        order: i,
        options: type === "select" ? ["Morning", "Afternoon"] : [],
      }));
    });
    const key = crypto.randomUUID();
    const input = {
      ...payload,
      customFields: {
        [ids[0]]: "Gift",
        [ids[1]]: "Please ring the bell",
        [ids[2]]: "Morning",
      },
    };
    const receipt = await ops.checkout(
      f.store.slug,
      f.product.slug,
      key,
      input,
    );
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.orderNumber, receipt.orderNumber));
    expect(
      await ops.checkout(f.store.slug, f.product.slug, key, {
        ...input,
        customFields: Object.fromEntries(
          Object.entries(input.customFields).reverse(),
        ),
      }),
    ).toEqual(receipt);
    expect(order.customFieldSnapshots.map((s) => s.value)).toEqual([
      "Gift",
      "Please ring the bell",
      "Morning",
    ]);
    await configure(f.store.id, (s) => {
      s.productPage.customFields = [];
    });
    expect(
      (await ops.getOrder(a, order.id)).order.customFieldSnapshots,
    ).toEqual(order.customFieldSnapshots);
    expect(
      await ops.checkout(f.store.slug, f.product.slug, key, input),
    ).toEqual(receipt);
    await expect(
      ops.checkout(f.store.slug, f.product.slug, key, {
        ...input,
        customFields: { [ids[0]]: "Changed" },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("invalid custom Select and missing required field fail before Order creation", async () => {
    const f = await fixture();
    const id = crypto.randomUUID();
    await configure(f.store.id, (s) => {
      s.productPage.customFields = [
        {
          id,
          label: "Time",
          type: "select",
          enabled: true,
          required: true,
          order: 0,
          options: ["Morning"],
        },
      ];
    });
    await expect(
      checkout(f, { ...payload, customFields: { [id]: "Night" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(checkout(f)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(
      await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.storeId, f.store.id)),
    ).toEqual([]);
  });
  it.each(["inline", "popup"] as const)(
    "%s mode, sticky and hidden quantity preserve authoritative validation",
    async (mode) => {
      const f = await fixture();
      await configure(f.store.id, (s) => {
        s.productPage.mode = mode;
        s.productPage.sticky = false;
        s.productPage.quantity = false;
        s.productPage.fields = s.productPage.fields.map((field) =>
          ["region", "city", "address"].includes(field.id)
            ? { ...field, enabled: false }
            : field,
        );
      });
      await expect(checkout(f, { ...payload, phone: "bad" })).rejects.toThrow();
      await expect(checkout(f, { ...payload, address: "" })).rejects.toThrow();
      await expect(checkout(f, { ...payload, quantity: 21 })).rejects.toThrow();
      const order = await checkout(f);
      expect(order.totalMinor).toBe(399000);
    },
  );
});

describe("Dashboard grouped aggregation truth", () => {
  it("counts observations, cohorts, delivery dates, operational funnel, historical revenue and attribution", async () => {
    const f = await fixture();
    const ghana = await settings.addMarket(a, {
      storeId: f.store.id,
      countryCode: "GH",
    });
    await settings.createOffer(a, {
      productId: f.product.id,
      storeMarketId: ghana.id,
      price: "399",
    });
    const created = new Date("2026-09-10T12:00:00Z"),
      deliveredAt = new Date("2026-09-11T12:00:00Z");
    const outcomes = [
      "new",
      "confirmed",
      "shipped",
      "delivered",
      "returned",
      "refused",
    ] as const;
    for (const [index, outcome] of outcomes.entries()) {
      const order = await checkout(f, {
        ...payload,
        market: outcome === "refused" ? "GH" : "KE",
        phone: outcome === "refused" ? "+233241234567" : payload.phone,
        quantity: outcome === "delivered" ? 2 : 1,
      });
      await db
        .update(schema.orders)
        .set({ createdAt: created })
        .where(eq(schema.orders.id, order.id));
      await db
        .update(schema.orderAttribution)
        .set({
          marketingConsent: outcome !== "returned",
          utmSource: ["meta", "tiktok", "google", "direct", null, "newsletter"][
            index
          ],
          landingUrl: "https://example.com",
          referrer: null,
        })
        .where(eq(schema.orderAttribution.orderId, order.id));
      if (outcome !== "new") {
        await ops.recordAttempt(a, order.id, {
          outcome: "confirmed",
          requestKey: crypto.randomUUID(),
        });
        if (outcome !== "confirmed") {
          await ops.createFulfillment(a, order.id);
          const shipment = await ops.createManualShipment(a, order.id);
          await db
            .update(schema.shipments)
            .set({
              status: outcome,
              shippedAt: created,
              deliveredAt:
                outcome === "delivered" || outcome === "returned"
                  ? deliveredAt
                  : null,
            })
            .where(eq(schema.shipments.id, shipment.id));
        }
      }
    }
    // A delivery in range from an order outside the creation cohort belongs in the Delivered KPI only.
    const old = await checkout(f);
    await db
      .update(schema.orders)
      .set({ createdAt: new Date("2026-08-01") })
      .where(eq(schema.orders.id, old.id));
    await ops.recordAttempt(a, old.id, {
      outcome: "confirmed",
      requestKey: crypto.randomUUID(),
    });
    await ops.createFulfillment(a, old.id);
    const shipment = await ops.createManualShipment(a, old.id);
    await db
      .update(schema.shipments)
      .set({
        status: "delivered",
        shippedAt: new Date("2026-08-02"),
        deliveredAt,
      })
      .where(eq(schema.shipments.id, shipment.id));
    await db.insert(schema.visitorEvents).values(
      (
        [
          "store_view",
          "store_view",
          "product_view",
          "checkout_started",
        ] as const
      ).map((type) => ({
        id: crypto.randomUUID(),
        organizationId: orgA,
        storeId: f.store.id,
        productId: type === "store_view" ? null : f.product.id,
        type,
        occurredAt: created,
      })),
    );
    const input = {
      range: "custom",
      from: "2026-09-10",
      to: "2026-09-12",
      storeId: f.store.id,
    };
    const data = await dashboard.overview(a, input);
    expect(data.visitors).toBe(3);
    expect(data.deliveredInRange).toBe(2);
    expect(data.metrics).toMatchObject({
      orders: 6,
      confirmed: 5,
      shipped: 4,
      delivered: 1,
      refused: 1,
      returned: 1,
      processing: 3,
      revenue: { KES: "798000" },
    });
    expect(data.byProduct).toHaveLength(1);
    expect(data.byProduct[0]).toMatchObject({
      orders: 6,
      confirmed: 5,
      delivered: 1,
      revenue: { KES: "798000" },
    });
    expect(data.byMarket.find((m) => m.id === f.market.id)).toMatchObject({
      orders: 5,
      delivered: 1,
      revenue: { KES: "798000" },
    });
    expect(data.byMarket.find((m) => m.id === ghana.id)).toMatchObject({
      orders: 1,
      refused: 1,
      revenue: {},
    });
    expect(data.bySource.map((s) => s.name).sort()).toEqual([
      "Direct",
      "Google",
      "Meta",
      "Other",
      "TikTok",
      "Unknown",
    ]);
    expect(data.bySource.find((s) => s.name === "Direct")?.delivered).toBe(1);
    expect(data.series).toEqual([
      { day: "2026-09-10", visitors: 3, orders: 6, deliveries: 0 },
      { day: "2026-09-11", visitors: 0, orders: 0, deliveries: 2 },
      { day: "2026-09-12", visitors: 0, orders: 0, deliveries: 0 },
    ]);
    await settings.updateOffer(a, f.offer.id, {
      productId: f.product.id,
      storeMarketId: f.market.id,
      price: "9999",
    });
    expect((await dashboard.overview(a, input)).metrics.revenue).toEqual({
      KES: "798000",
    });
    expect(
      (
        await dashboard.overview(a, {
          ...input,
          from: "2026-09-13",
          to: "2026-09-14",
        })
      ).metrics.orders,
    ).toBe(0);
    await expect(dashboard.overview(b, input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("handles a brand new zero-data Store without Country catalog rows becoming market performance", async () => {
    const store = await settings.createStore(a, {
      name: "No Data",
      slug: `no-data-${crypto.randomUUID()}`,
    });
    const data = await dashboard.overview(a, {
      range: "today",
      storeId: store.id,
    });
    expect(data.visitors).toBe(0);
    expect(data.metrics.orders).toBe(0);
    expect(data.byMarket).toEqual([]);
    expect(data.byProduct).toEqual([]);
  });
});
