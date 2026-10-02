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
  categories,
  products,
  productPages,
  productMarketOffers,
  contentPages,
} from "@africacod/db";
import "@africacod/shared";
import { ContentService } from "./content";
import { AppsService } from "./apps";
import { defaultPageConfig } from "./storefront";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use isolated test DB");
const { db, client } = createDatabase(url);
const service = new ContentService(db);
const apps = new AppsService(db);
const a = crypto.randomUUID(),
  b = crypto.randomUUID();
const slug = `glow-cms-${a}`;
let orgA: string,
  orgB: string,
  storeId: string,
  otherStoreId: string,
  foreignStoreId: string,
  kenya: string,
  ghana: string,
  hairId: string,
  beautyId: string,
  productId: string,
  offerId: string,
  pageId: string;
const input = () => ({
  storeId,
  title: "About Glow Beauty",
  slug: "about",
  content:
    "## Our story\n\nLocal **care** for every day.\n\n- Real products\n- Cash on delivery",
  metaTitle: "About our brand",
  metaDescription: "Meet Glow Beauty.",
  showInNavigation: true,
  navigationLabel: "About",
  navigationOrder: 1,
});
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
      name: "CMS Merchant",
      email: `${id}@example.com`,
    })),
  );
  orgA = (await service.createOrganization(a, { name: "CMS A" })).id;
  orgB = (await service.createOrganization(b, { name: "CMS B" })).id;
  storeId = (await service.createStore(a, { name: "Glow Beauty", slug })).id;
  otherStoreId = (
    await service.createStore(a, {
      name: "Other Store",
      slug: `other-cms-${a}`,
    })
  ).id;
  foreignStoreId = (
    await service.createStore(b, {
      name: "Foreign Store",
      slug: `foreign-cms-${b}`,
    })
  ).id;
  kenya = (await service.addMarket(a, { storeId, countryCode: "KE" })).id;
  ghana = (await service.addMarket(a, { storeId, countryCode: "GH" })).id;
  await service.addMarket(a, { storeId, countryCode: "RW" });
  beautyId = (
    await service.createCategory(a, { storeId, name: "Beauty", slug: "beauty" })
  ).id;
  hairId = (
    await service.createCategory(a, {
      storeId,
      name: "Hair",
      slug: "hair",
      parentId: beautyId,
    })
  ).id;
  const body = (
    await service.createCategory(a, { storeId, name: "Body", slug: "body" })
  ).id;
  for (const [
    name,
    productSlug,
    categoryId,
    subcategoryId,
    hasKenya,
    hasGhana,
    published,
  ] of [
    ["Hair Growth Serum", "serum", beautyId, hairId, true, true, true],
    ["Body soap", "soap", body, null, true, false, true],
    ["No offers", "no-offers", null, null, false, false, true],
    ["Unpublished", "unpublished", null, null, true, true, false],
  ] as const) {
    const product = await service.createProduct(a, {
      storeId,
      name,
      slug: productSlug,
      categoryId,
      subcategoryId,
      status: "active",
    });
    if (productSlug === "serum") productId = product.id;
    if (hasKenya) {
      const offer = await service.createOffer(a, {
        productId: product.id,
        storeMarketId: kenya,
        price: productSlug === "serum" ? "3990" : "99",
        cost: "10",
      });
      if (productSlug === "serum") offerId = offer.id;
    }
    if (hasGhana)
      await service.createOffer(a, {
        productId: product.id,
        storeMarketId: ghana,
        price: "399",
        cost: "10",
      });
    await service.savePageDraft(a, product.id, defaultPageConfig(product, []));
    if (published) await service.publishPage(a, product.id);
  }
});
afterAll(async () => {
  for (const org of [orgA, orgB].filter(Boolean)) {
    for (const table of [
      contentPages,
      productPages,
      productMarketOffers,
      products,
      categories,
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
describe.sequential(
  "Store CMS, public catalog and integration foundation",
  () => {
    it("creates a store-scoped CMS draft with no public access or navigation", async () => {
      const page = await service.saveContentPage(a, null, input());
      pageId = page.id;
      expect(page).toMatchObject({
        status: "draft",
        publishedContent: null,
        publishedSlug: null,
        organizationId: orgA,
        storeId,
      });
      await expect(
        service.getPublicContentPage(slug, "about"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await service.getPublicStore(slug)).pages).toEqual([]);
    });
    it("publishes content, metadata and navigation as one snapshot", async () => {
      await service.publishContentPage(a, pageId);
      expect(await service.getPublicContentPage(slug, "about")).toMatchObject({
        title: "About Glow Beauty",
        content: input().content,
        metaTitle: "About our brand",
        metaDescription: "Meet Glow Beauty.",
      });
      expect((await service.getPublicStore(slug)).pages).toEqual([
        { slug: "about", label: "About", order: 1 },
      ]);
    });
    it("draft edits including slug/title/SEO/navigation do not modify the published page", async () => {
      const before = await service.getPublicContentPage(slug, "about");
      await service.saveContentPage(a, pageId, {
        ...input(),
        title: "Private title",
        slug: "about-new",
        content: "Private new draft",
        metaTitle: "Secret SEO",
        metaDescription: "Private description",
        showInNavigation: false,
        navigationLabel: "Private nav",
      });
      expect(await service.getPublicContentPage(slug, "about")).toEqual(before);
      await expect(
        service.getPublicContentPage(slug, "about-new"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await service.getPublicStore(slug)).pages[0].label).toBe("About");
    });
    it("enforces store-scoped draft and published-slug uniqueness", async () => {
      await expect(
        service.saveContentPage(a, null, { ...input(), slug: "about-new" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const conflicting = await service.saveContentPage(a, null, input());
      await expect(
        service.publishContentPage(a, conflicting.id),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const independent = await service.saveContentPage(a, null, {
        ...input(),
        storeId: otherStoreId,
      });
      expect(independent.slug).toBe("about");
    });
    it("unpublishing removes public access/navigation while preserving the draft and previous snapshot", async () => {
      await service.unpublishContentPage(a, pageId);
      await expect(
        service.getPublicContentPage(slug, "about"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const page = await service.getContentPage(a, pageId);
      expect(page.publishedContent?.title).toBe("About Glow Beauty");
      expect(page.draftContent).toBe("Private new draft");
      expect((await service.getPublicStore(slug)).pages).toEqual([]);
      await service.publishContentPage(a, pageId);
      expect(
        (await service.getPublicContentPage(slug, "about-new")).title,
      ).toBe("Private title");
    });
    it("shows only valid published offers for the requested Kenya/Ghana market", async () => {
      const ke = await service.browseStore(slug, "KE");
      const gh = await service.browseStore(slug, "GH");
      expect(ke.products.map((p) => p.slug)).toEqual(["serum", "soap"]);
      expect(ke.products[0]).toMatchObject({
        priceMinor: 399000,
        currency: "KES",
      });
      expect(gh.products).toHaveLength(1);
      expect(gh.products[0]).toMatchObject({
        name: "Hair Growth Serum",
        priceMinor: 39900,
        currency: "GHS",
      });
      expect((await service.browseStore(slug, "RW")).products).toEqual([]);
      expect((await service.browseStore(slug)).selected).toBeNull();
      expect(await service.browseStore(slug, "ZZ")).toMatchObject({
        selected: null,
        invalidMarket: true,
        products: [],
      });
    });
    it("hides inactive markets and offers, and preserves their data", async () => {
      await service.setMarketStatus(a, {
        storeId,
        marketId: kenya,
        status: "inactive",
      });
      expect(await service.browseStore(slug, "KE")).toMatchObject({
        selected: null,
        invalidMarket: true,
        products: [],
      });
      await service.setMarketStatus(a, {
        storeId,
        marketId: kenya,
        status: "active",
      });
      await service.updateOffer(a, offerId, {
        productId,
        storeMarketId: kenya,
        price: "3990",
        cost: "10",
        status: "inactive",
      });
      expect(
        (await service.browseStore(slug, "KE")).products.map((p) => p.slug),
      ).toEqual(["soap"]);
      await service.updateOffer(a, offerId, {
        productId,
        storeMarketId: kenya,
        price: "3990",
        cost: "10",
        status: "active",
      });
    });
    it("filters top-level categories and subcategories without changing the hierarchy", async () => {
      for (const category of ["beauty", "hair"])
        expect(
          (await service.browseStore(slug, "KE", category)).products.map(
            (p) => p.slug,
          ),
        ).toEqual(["serum"]);
      expect(
        (await service.browseStore(slug, "KE", "body")).products.map(
          (p) => p.slug,
        ),
      ).toEqual(["soap"]);
      await expect(
        service.browseStore(slug, "KE", "unknown"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await db
        .update(categories)
        .set({ status: "inactive" })
        .where(eq(categories.id, beautyId));
      await expect(
        service.browseStore(slug, "KE", "hair"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await db
        .update(categories)
        .set({ status: "active" })
        .where(eq(categories.id, beautyId));
      expect(
        (await service.getPublicStore(slug)).categories.find(
          (c) => c.slug === "hair",
        )?.parentSlug,
      ).toBe("beauty");
    });
    it("public store/page/grid projections omit drafts, costs and organization internals", async () => {
      const output = JSON.stringify(await service.browseStore(slug, "KE"));
      for (const field of [
        "costMinor",
        "unitCost",
        "organizationId",
        "storageKey",
        orgA,
        "Private new draft",
        "Secret SEO",
      ])
        expect(output).not.toContain(field);
      expect((await service.browseStore(slug, "GH")).products).toHaveLength(1);
      expect(
        (await service.browseStore(slug, "KE", undefined, 2)).products,
      ).toEqual([]);
    });
    it("branding is editable without changing the store slug or auto-creating markets", async () => {
      await service.updateBranding(a, storeId, {
        name: "Glow Beauty",
        tagline: "Everyday care.",
        contactEmail: "hello@example.com",
        contactPhone: "+254712345678",
        slug: "stolen",
        logo: "https://untrusted.example/logo",
      });
      const store = await service.getPublicStore(slug);
      expect(store).toMatchObject({
        name: "Glow Beauty",
        tagline: "Everyday care.",
        contactEmail: "hello@example.com",
        logoUrl: null,
      });
      expect(await service.listMarkets(a, otherStoreId)).toHaveLength(0);
    });
    it("validates logo uploads and exposes only active-store owned logo files", async () => {
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
      await expect(
        service.uploadStoreLogo(
          a,
          storeId,
          new Uint8Array([1]),
          "image/png",
          storage,
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      const png = Uint8Array.from(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      );
      await service.uploadStoreLogo(a, storeId, png, "image/png", storage);
      const first = await service.getPublicLogo(slug);
      expect(files.has(first.storageKey)).toBe(true);
      expect((await service.getPublicStore(slug)).logoUrl).toBe(
        `/s/${slug}/logo`,
      );
      await service.uploadStoreLogo(a, storeId, png, "image/png", storage);
      expect(files.has(first.storageKey)).toBe(false);
    });
    it("denies foreign page, branding, logo and store-scoped app operations", async () => {
      await Promise.all(
        [
          service.getContentPage(b, pageId),
          service.saveContentPage(b, pageId, input()),
          service.publishContentPage(b, pageId),
          service.unpublishContentPage(b, pageId),
          service.updateBranding(b, storeId, { name: "Stolen" }),
          apps.listApps(b, storeId),
          service.listContentPages(b, storeId),
        ].map((operation) =>
          expect(operation).rejects.toMatchObject({ code: "NOT_FOUND" }),
        ),
      );
      expect(await service.listContentPages(b)).toEqual([]);
      await expect(
        db.insert(contentPages).values({
          organizationId: orgA,
          storeId: foreignStoreId,
          title: "Bad tenant",
          slug: "bad",
        }),
      ).rejects.toThrow();
    });
    it("provides an honest immutable app catalog with no fake connections", async () => {
      const catalog = await apps.listApps(a, storeId);
      expect(catalog).toHaveLength(6);
      expect(catalog.every((app) => app.status === "Coming soon")).toBe(true);
      expect(Reflect.set(catalog[0], "status", "Connected")).toBe(false);
      expect(catalog[0].status).toBe("Coming soon");
      await expect(apps.listApps(null)).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
      });
    });
    it("inactive stores hide the storefront, CMS pages and logo", async () => {
      await db
        .update(stores)
        .set({ status: "inactive" })
        .where(eq(stores.id, storeId));
      await Promise.all(
        [
          service.getPublicStore(slug),
          service.getPublicContentPage(slug, "about-new"),
          service.browseStore(slug, "KE"),
          service.getPublicLogo(slug),
        ].map((operation) =>
          expect(operation).rejects.toMatchObject({ code: "NOT_FOUND" }),
        ),
      );
      await db
        .update(stores)
        .set({ status: "active" })
        .where(eq(stores.id, storeId));
    });
  },
);
