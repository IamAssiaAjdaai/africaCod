import { beforeAll, afterAll, describe, expect, it } from "vitest";
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
  categories,
  products,
  productVariants,
  productMedia,
  productMarketOffers,
} from "@africacod/db";
import "@africacod/shared";
import { CatalogService, type MediaStorage } from "./index";
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test"))
  throw new Error("Use an isolated _test database.");
const { db, client } = createDatabase(testUrl);
const service = new CatalogService(db);
const a = crypto.randomUUID(),
  b = crypto.randomUUID();
let orgA: string,
  orgB: string,
  storeA: string,
  storeOther: string,
  storeB: string;
let beauty: string,
  hair: string,
  foreignCategory: string,
  foreignProduct: string,
  productId: string;
let kenya: string, ghana: string, otherMarket: string, foreignMarket: string;
let offerId: string, variantId: string, mediaId: string, secondMediaId: string;
const files = new Map<string, Uint8Array>();
const storage: MediaStorage = {
  async put(key, bytes) {
    files.set(key, bytes);
  },
  async read(key) {
    const bytes = files.get(key);
    if (!bytes) throw new Error("Missing file");
    return bytes;
  },
  async remove(key) {
    files.delete(key);
  },
};
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
);
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
      name: "Catalog test",
      email: `${id}@example.com`,
    })),
  );
  orgA = (await service.createOrganization(a, { name: "Catalog A" })).id;
  orgB = (await service.createOrganization(b, { name: "Catalog B" })).id;
  storeA = (
    await service.createStore(a, { name: "Glow Beauty", slug: `beauty-${a}` })
  ).id;
  storeOther = (
    await service.createStore(a, {
      name: "Same tenant other store",
      slug: `other-${a}`,
    })
  ).id;
  storeB = (
    await service.createStore(b, {
      name: "Foreign store",
      slug: `foreign-${b}`,
    })
  ).id;
  kenya = (await service.addMarket(a, { storeId: storeA, countryCode: "KE" }))
    .id;
  ghana = (await service.addMarket(a, { storeId: storeA, countryCode: "GH" }))
    .id;
  otherMarket = (
    await service.addMarket(a, { storeId: storeOther, countryCode: "RW" })
  ).id;
  foreignMarket = (
    await service.addMarket(b, { storeId: storeB, countryCode: "KE" })
  ).id;
  foreignCategory = (
    await service.createCategory(b, {
      storeId: storeB,
      name: "Foreign beauty",
      slug: "beauty",
    })
  ).id;
  foreignProduct = (
    await service.createProduct(b, {
      storeId: storeB,
      name: "Foreign serum",
      slug: "serum",
    })
  ).id;
});
afterAll(async () => {
  for (const id of [orgA, orgB].filter(Boolean)) {
    await db
      .delete(productMarketOffers)
      .where(eq(productMarketOffers.organizationId, id));
    await db.delete(productMedia).where(eq(productMedia.organizationId, id));
    await db
      .delete(productVariants)
      .where(eq(productVariants.organizationId, id));
    await db.delete(products).where(eq(products.organizationId, id));
    await db.delete(categories).where(eq(categories.organizationId, id));
    await db.delete(storeMarkets).where(eq(storeMarkets.organizationId, id));
    await db.delete(stores).where(eq(stores.organizationId, id));
    await db.delete(memberships).where(eq(memberships.organizationId, id));
    await db.delete(organizations).where(eq(organizations.id, id));
  }
  await db.delete(user).where(eq(user.id, a));
  await db.delete(user).where(eq(user.id, b));
  await client.end();
});
describe.sequential("Store catalog, media, variants and market offers", () => {
  it("creates a top-level category and a subcategory", async () => {
    const category = await service.createCategory(a, {
      storeId: storeA,
      name: "Beauty",
      slug: "beauty",
    });
    beauty = category.id;
    const sub = await service.createCategory(a, {
      storeId: storeA,
      name: "Hair",
      slug: "hair",
      parentId: beauty,
    });
    hair = sub.id;
    expect(category).toMatchObject({
      parentId: null,
      depth: 0,
      organizationId: orgA,
    });
    expect(sub).toMatchObject({ parentId: beauty, depth: 1 });
  });
  it("rejects third-level, cross-store and cross-tenant parent references", async () => {
    await expect(
      service.createCategory(a, {
        storeId: storeA,
        name: "Third",
        slug: "third",
        parentId: hair,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.createCategory(a, {
        storeId: storeOther,
        name: "Cross store",
        slug: "cross",
        parentId: beauty,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.createCategory(a, {
        storeId: storeA,
        name: "Cross tenant",
        slug: "cross",
        parentId: foreignCategory,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      db.insert(categories).values({
        organizationId: orgA,
        storeId: storeA,
        name: "Raw third",
        slug: "raw-third",
        parentId: hair,
        depth: 1,
      }),
    ).rejects.toThrow();
  });
  it("protects categories with children from becoming subcategories", async () => {
    const parent = await service.createCategory(a, {
      storeId: storeA,
      name: "Another parent",
      slug: "another-parent",
    });
    await expect(
      service.updateCategory(a, beauty, {
        storeId: storeA,
        name: "Beauty",
        slug: "beauty",
        parentId: parent.id,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("creates a product assigned to Hair with no offers or product price fields", async () => {
    const product = await service.createProduct(a, {
      storeId: storeA,
      name: "Hair Growth Serum",
      slug: "hair-growth-serum",
      sku: "serum-001",
      categoryId: beauty,
      subcategoryId: hair,
      price: 5,
      currency: "USD",
      organizationId: orgB,
    });
    productId = product.id;
    expect(product).toMatchObject({
      organizationId: orgA,
      sku: "SERUM-001",
      status: "draft",
      subcategoryId: hair,
    });
    expect(product).not.toHaveProperty("price");
    expect(product).not.toHaveProperty("currency");
    expect(await service.listOffers(a, product.id)).toEqual([]);
  });
  it("enforces store-scoped slug/SKU uniqueness and valid product categories", async () => {
    await expect(
      service.createProduct(a, {
        storeId: storeA,
        name: "Duplicate",
        slug: "hair-growth-serum",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      service.createProduct(a, {
        storeId: storeA,
        name: "Duplicate SKU",
        slug: "different",
        sku: "SERUM-001",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await service.createProduct(a, {
        storeId: storeOther,
        name: "Independent",
        slug: "hair-growth-serum",
        sku: "serum-001",
      }),
    ).toMatchObject({ storeId: storeOther });
    await expect(
      service.createProduct(a, {
        storeId: storeOther,
        name: "Bad category",
        slug: "bad",
        categoryId: beauty,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.createProduct(a, {
        storeId: storeA,
        name: "Bad sub",
        slug: "bad-sub",
        categoryId: hair,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      db.insert(products).values({
        organizationId: orgA,
        storeId: storeA,
        name: "Raw bad",
        slug: "raw-bad",
        subcategoryId: hair,
      }),
    ).rejects.toThrow();
  });
  it("creates Kenya and Ghana offers independently with authoritative currencies and minor units", async () => {
    const offer = await service.createOffer(a, {
      productId,
      storeMarketId: kenya,
      price: "3990",
      compareAtPrice: "4990",
      cost: "1200",
      currency: "USD",
    });
    offerId = offer.id;
    expect(offer).toMatchObject({
      priceMinor: 399000,
      compareAtPriceMinor: 499000,
      costMinor: 120000,
      currency: "KES",
      storeId: storeA,
      organizationId: orgA,
    });
    expect(
      await service.createOffer(a, {
        productId,
        storeMarketId: ghana,
        price: "399",
        compareAtPrice: "499",
        cost: "120",
      }),
    ).toMatchObject({ priceMinor: 39900, currency: "GHS" });
    expect(await service.listOffers(a, productId)).toHaveLength(2);
  });
  it("rejects duplicate offers, unselected Rwanda, cross-store and cross-tenant markets", async () => {
    await expect(
      service.createOffer(a, { productId, storeMarketId: kenya, price: "1" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    for (const storeMarketId of [
      crypto.randomUUID(),
      otherMarket,
      foreignMarket,
    ])
      await expect(
        service.createOffer(a, {
          productId,
          storeMarketId,
          price: "1",
          countryCode: "RW",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (await service.listMarkets(a, storeA)).some(
        (market) => market.countryCode === "RW",
      ),
    ).toBe(false);
    await expect(
      db.insert(productMarketOffers).values({
        organizationId: orgA,
        storeId: storeA,
        productId,
        storeMarketId: otherMarket,
        priceMinor: 100,
        currency: "RWF",
      }),
    ).rejects.toThrow();
  });
  it("rejects invalid prices, compare-at and negative cost on the server", async () => {
    for (const values of [
      { price: "0" },
      { price: "1.001" },
      { price: "-1" },
      { price: "100", compareAtPrice: "99" },
      { price: "100", cost: "-1" },
    ])
      await expect(
        service.updateOffer(a, offerId, {
          productId,
          storeMarketId: kenya,
          ...values,
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      db
        .update(productMarketOffers)
        .set({ priceMinor: 0 })
        .where(eq(productMarketOffers.id, offerId)),
    ).rejects.toThrow();
  });
  it("keeps product editing independent from offer values", async () => {
    const before = await service.listOffers(a, productId);
    await service.updateProduct(a, productId, {
      storeId: storeA,
      name: "Hair Growth Serum",
      slug: "hair-growth-serum",
      categoryId: beauty,
      subcategoryId: hair,
      status: "active",
      price: "1",
      currency: "USD",
    });
    expect(await service.listOffers(a, productId)).toEqual(before);
    await service.updateCategory(a, hair, {
      storeId: storeA,
      name: "Hair",
      slug: "hair",
      parentId: beauty,
      status: "inactive",
    });
    expect((await service.getProduct(a, productId)).subcategoryId).toBe(hair);
    await expect(
      db.delete(categories).where(eq(categories.id, hair)),
    ).rejects.toThrow();
  });
  it("supports basic variants with no price fields and scoped edits", async () => {
    const variant = await service.createVariant(a, {
      productId,
      name: "50 ml",
      sku: "SERUM-50",
    });
    variantId = variant.id;
    expect(variant).not.toHaveProperty("price");
    await service.createVariant(a, {
      productId,
      name: "100 ml",
      sku: "SERUM-100",
      sortOrder: 1,
    });
    expect(
      await service.updateVariant(a, variantId, {
        productId,
        name: "50 ml",
        sku: "serum-50",
        status: "inactive",
        sortOrder: 2,
      }),
    ).toMatchObject({ status: "inactive", sortOrder: 2 });
    await expect(
      service.createVariant(a, {
        productId,
        name: "Duplicate",
        sku: "SERUM-50",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("uploads, previews and reorders product media through a storage interface", async () => {
    const first = await service.uploadMedia(
      a,
      { productId, altText: "Serum bottle" },
      png,
      "image/png",
      storage,
    );
    mediaId = first.id;
    const second = await service.uploadMedia(
      a,
      { productId },
      png,
      "image/png",
      storage,
    );
    secondMediaId = second.id;
    expect(await storage.read(first.storageKey)).toEqual(png);
    await service.reorderMedia(a, { productId, ids: [second.id, first.id] });
    expect(
      (await service.listMedia(a, productId)).map((row) => row.id),
    ).toEqual([second.id, first.id]);
    await expect(
      service.reorderMedia(a, { productId, ids: [first.id, first.id] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const before = files.size;
    await expect(
      service.uploadMedia(a, { productId }, png, "image/jpeg", storage),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(files.size).toBe(before);
  });
  it("blocks cross-tenant reads and mutations across every catalog resource", async () => {
    await expect(service.listCategories(b, storeA)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.getCategory(b, beauty)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.updateCategory(b, beauty, {
        storeId: storeA,
        name: "Stolen",
        slug: "stolen",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.getProduct(b, productId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.updateProduct(b, productId, {
        storeId: storeA,
        name: "Stolen",
        slug: "stolen",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.createProduct(b, {
        storeId: storeA,
        name: "Stolen",
        slug: "stolen",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.listVariants(b, productId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.updateVariant(b, variantId, {
        productId: foreignProduct,
        name: "Stolen",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.createVariant(b, { productId, name: "Stolen" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.getMedia(b, mediaId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.removeMedia(b, mediaId, storage),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.uploadMedia(b, { productId }, png, "image/png", storage),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.reorderMedia(b, { productId: foreignProduct, ids: [mediaId] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.listOffers(b, productId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.updateOffer(b, offerId, {
        productId: foreignProduct,
        storeMarketId: foreignMarket,
        price: "1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (await service.listProducts(a)).some((row) => row.id === foreignProduct),
    ).toBe(false);
    expect((await service.listMedia(b)).some((row) => row.id === mediaId)).toBe(
      false,
    );
  });
  it("preserves offers when a store market is deactivated and forbids new active pricing", async () => {
    await service.setMarketStatus(a, {
      storeId: storeA,
      marketId: kenya,
      status: "inactive",
    });
    expect(
      (await service.listOffers(a, productId)).some(
        (row) => row.id === offerId,
      ),
    ).toBe(true);
    await expect(
      service.updateOffer(a, offerId, {
        productId,
        storeMarketId: kenya,
        price: "3990",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await service.setMarketStatus(a, {
      storeId: storeA,
      marketId: kenya,
      status: "active",
    });
  });
  it("removes owned images and storage objects without removing other media", async () => {
    const media = await service.getMedia(a, mediaId);
    await service.removeMedia(a, mediaId, storage);
    expect(files.has(media.storageKey)).toBe(false);
    expect(
      (await service.listMedia(a, productId)).map((row) => row.id),
    ).toEqual([secondMediaId]);
  });
  it("protects raw product, category, variant and media tenant relationships", async () => {
    await expect(
      db.insert(products).values({
        organizationId: orgA,
        storeId: storeB,
        name: "Mismatch",
        slug: "mismatch",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(categories).values({
        organizationId: orgA,
        storeId: storeOther,
        parentId: beauty,
        depth: 1,
        name: "Mismatch",
        slug: "mismatch",
      }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(productVariants)
        .values({ organizationId: orgB, productId, name: "Mismatch" }),
    ).rejects.toThrow();
    await expect(
      db.insert(productMedia).values({
        organizationId: orgB,
        productId,
        storageKey: `${crypto.randomUUID()}.png`,
        mimeType: "image/png",
      }),
    ).rejects.toThrow();
  });
});
