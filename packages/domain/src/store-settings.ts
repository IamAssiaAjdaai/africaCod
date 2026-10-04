import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  stores,
  storeAssets,
  categories,
  contentPages,
  products,
  storeMarkets,
  productMarketOffers,
} from "@africacod/db";
import { storeSettingsInput } from "@africacod/validation";
import { CatalogService } from "./catalog";
import { DomainError } from "./commerce";
import { validateImage, type MediaStorage } from "./media";
export const assetSlots = [
  "logoLight",
  "logoDark",
  "favicon",
  "heroLight",
  "heroDark",
] as const;
export class StoreSettingsService extends CatalogService {
  override async getStore(userId: string | null, storeId: string) {
    return super.getStore(userId, z.uuid().parse(storeId));
  }
  async settings(userId: string | null, storeId: string) {
    const store = await this.getStore(userId, z.uuid().parse(storeId));
    const assets = await this.db
      .select({ id: storeAssets.id })
      .from(storeAssets)
      .where(
        and(
          eq(storeAssets.storeId, store.id),
          eq(storeAssets.organizationId, store.organizationId),
        ),
      );
    return {
      draft: storeSettingsInput.parse(store.draftSettings),
      revision: store.settingsRevision,
      publishedRevision: store.publishedRevision,
      publishedAt: store.settingsPublishedAt,
      assets,
    };
  }
  async saveDraft(
    userId: string | null,
    storeId: string,
    input: unknown,
    revision: number,
  ) {
    const store = await this.getStore(userId, z.uuid().parse(storeId));
    const settings = storeSettingsInput.parse(input);
    const assetIds = assetSlots.flatMap((slot) =>
      settings.identity[slot] ? [settings.identity[slot]!] : [],
    );
    const targets = [
      ...settings.navigation.header,
      ...settings.navigation.footer,
      settings.navigation.cta,
    ].map((link) => link.target);
    const categoryIds = [
      ...targets.flatMap((t) => (t.kind === "category" ? [t.id] : [])),
      ...(settings.featured.categoryId ? [settings.featured.categoryId] : []),
    ];
    const pageIds = targets.flatMap((t) => (t.kind === "page" ? [t.id] : []));
    const [assets, categoryRows, pageRows, productRows] = await Promise.all([
      assetIds.length
        ? this.db
            .select({ id: storeAssets.id })
            .from(storeAssets)
            .where(
              and(
                eq(storeAssets.storeId, store.id),
                eq(storeAssets.organizationId, store.organizationId),
                inArray(storeAssets.id, assetIds),
              ),
            )
        : [],
      categoryIds.length
        ? this.db
            .select({ id: categories.id })
            .from(categories)
            .where(
              and(
                eq(categories.storeId, store.id),
                eq(categories.organizationId, store.organizationId),
                inArray(categories.id, categoryIds),
              ),
            )
        : [],
      pageIds.length
        ? this.db
            .select({ id: contentPages.id })
            .from(contentPages)
            .where(
              and(
                eq(contentPages.storeId, store.id),
                eq(contentPages.organizationId, store.organizationId),
                inArray(contentPages.id, pageIds),
              ),
            )
        : [],
      settings.featured.productIds.length
        ? this.db
            .select({ id: products.id })
            .from(products)
            .where(
              and(
                eq(products.storeId, store.id),
                eq(products.organizationId, store.organizationId),
                inArray(products.id, settings.featured.productIds),
              ),
            )
        : [],
    ]);
    if (
      [
        [assetIds, assets],
        [categoryIds, categoryRows],
        [pageIds, pageRows],
        [settings.featured.productIds, productRows],
      ].some(([ids, rows]) =>
        (ids as string[]).some(
          (id) => !(rows as { id: string }[]).some((r) => r.id === id),
        ),
      )
    )
      throw new DomainError(
        "INVALID_INPUT",
        "Choose resources belonging to this Store.",
      );
    const [updated] = await this.db
      .update(stores)
      .set({
        draftSettings: settings,
        settingsRevision: sql`${stores.settingsRevision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stores.id, store.id),
          eq(stores.organizationId, store.organizationId),
          eq(
            stores.settingsRevision,
            z.number().int().nonnegative().parse(revision),
          ),
        ),
      )
      .returning();
    if (!updated)
      throw new DomainError(
        "CONFLICT",
        "Another editor saved this Store. Reload before saving.",
      );
    return this.settings(userId, store.id);
  }
  async setup(userId: string | null, storeId: string) {
    const store = await this.getStore(userId, storeId);
    const [state] = await this.db
      .select({
        market: sql<boolean>`exists(select 1 from store_markets m where m.store_id = ${store.id} and m.organization_id = ${store.organizationId} and m.status = 'active')`,
        product: sql<boolean>`exists(select 1 from products p where p.store_id = ${store.id} and p.organization_id = ${store.organizationId})`,
        activeProduct: sql<boolean>`exists(select 1 from products p where p.store_id = ${store.id} and p.organization_id = ${store.organizationId} and p.status = 'active')`,
        pricing: sql<boolean>`exists(select 1 from product_market_offers o join products p on p.id = o.product_id and p.organization_id = o.organization_id join store_markets m on m.id = o.store_market_id and m.organization_id = o.organization_id where o.store_id = ${store.id} and o.organization_id = ${store.organizationId} and p.store_id = ${store.id} and m.store_id = ${store.id} and o.status = 'active' and p.status = 'active' and m.status = 'active')`,
      })
      .from(stores)
      .where(
        and(
          eq(stores.id, store.id),
          eq(stores.organizationId, store.organizationId),
        ),
      );
    return {
      ...state,
      customized: store.settingsRevision > 0,
      published: !!store.settingsPublishedAt,
    };
  }
  async publish(userId: string | null, storeId: string, revision: number) {
    const store = await this.getStore(userId, z.uuid().parse(storeId));
    await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(stores)
        .where(
          and(
            eq(stores.id, store.id),
            eq(stores.organizationId, store.organizationId),
          ),
        )
        .for("update");
      if (
        current.settingsRevision !==
        z.number().int().nonnegative().parse(revision)
      )
        throw new DomainError(
          "CONFLICT",
          "Draft changed. Reload before publishing.",
        );
      if (current.status !== "active")
        throw new DomainError(
          "INVALID_INPUT",
          "Activate this Store before publishing.",
        );
      const [ready] = await tx
        .select({ id: productMarketOffers.id })
        .from(productMarketOffers)
        .innerJoin(products, eq(products.id, productMarketOffers.productId))
        .innerJoin(
          storeMarkets,
          eq(storeMarkets.id, productMarketOffers.storeMarketId),
        )
        .where(
          and(
            eq(productMarketOffers.storeId, store.id),
            eq(productMarketOffers.organizationId, store.organizationId),
            eq(productMarketOffers.status, "active"),
            eq(products.status, "active"),
            eq(storeMarkets.status, "active"),
          ),
        )
        .limit(1)
        .for("share");
      if (!ready)
        throw new DomainError(
          "INVALID_INPUT",
          "Before publishing: add an active Market and an active Product with an active Market offer.",
        );
      const settings = storeSettingsInput.parse(current.draftSettings);
      const assetIds = assetSlots.flatMap((slot) =>
        settings.identity[slot] ? [settings.identity[slot]!] : [],
      );
      if (assetIds.length) {
        const owned = await tx
          .select({ id: storeAssets.id })
          .from(storeAssets)
          .where(
            and(
              eq(storeAssets.storeId, store.id),
              eq(storeAssets.organizationId, store.organizationId),
              inArray(storeAssets.id, assetIds),
            ),
          )
          .for("share");
        if (assetIds.some((id) => !owned.some((a) => a.id === id)))
          throw new DomainError(
            "INVALID_INPUT",
            "Choose images uploaded to this Store.",
          );
      }
      const targets = [
        ...settings.navigation.header,
        ...settings.navigation.footer,
        ...(settings.navigation.cta.enabled ? [settings.navigation.cta] : []),
      ].map((link) => link.target);
      const categoryIds = [
        ...targets.flatMap((t) => (t.kind === "category" ? [t.id] : [])),
        ...(settings.featured.mode === "category" &&
        settings.featured.categoryId
          ? [settings.featured.categoryId]
          : []),
      ];
      if (categoryIds.length) {
        const owned = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              eq(categories.storeId, store.id),
              eq(categories.organizationId, store.organizationId),
              eq(categories.status, "active"),
              inArray(categories.id, categoryIds),
            ),
          )
          .for("share");
        if (categoryIds.some((id) => !owned.some((c) => c.id === id)))
          throw new DomainError(
            "INVALID_INPUT",
            "Choose active categories from this Store.",
          );
      }
      const pageIds = targets.flatMap((t) => (t.kind === "page" ? [t.id] : []));
      if (pageIds.length) {
        const owned = await tx
          .select({ id: contentPages.id })
          .from(contentPages)
          .where(
            and(
              eq(contentPages.storeId, store.id),
              eq(contentPages.organizationId, store.organizationId),
              eq(contentPages.status, "published"),
              inArray(contentPages.id, pageIds),
            ),
          )
          .for("share");
        if (pageIds.some((id) => !owned.some((p) => p.id === id)))
          throw new DomainError(
            "INVALID_INPUT",
            "Navigation can link only to this Store’s published CMS pages.",
          );
      }
      if (settings.featured.productIds.length) {
        const owned = await tx
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.storeId, store.id),
              eq(products.organizationId, store.organizationId),
              inArray(products.id, settings.featured.productIds),
            ),
          )
          .for("share");
        if (
          settings.featured.productIds.some(
            (id) => !owned.some((p) => p.id === id),
          )
        )
          throw new DomainError(
            "INVALID_INPUT",
            "Choose featured products from this Store.",
          );
      }
      // Materialize fallback identity once: later draft edits cannot change live identity.
      settings.identity.name ??= current.name;
      await tx
        .update(stores)
        .set({
          publishedSettings: settings,
          publishedRevision: current.settingsRevision,
          settingsPublishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stores.id, store.id));
    });
    return this.settings(userId, store.id);
  }
  async uploadAsset(
    userId: string | null,
    storeId: string,
    bytes: Uint8Array,
    mimeType: string,
    storage: MediaStorage,
  ) {
    const store = await this.getStore(userId, z.uuid().parse(storeId));
    const image = validateImage(bytes, mimeType);
    const storageKey = `${crypto.randomUUID()}.${image.extension}`;
    await storage.put(storageKey, bytes, image.mimeType);
    try {
      const [asset] = await this.db
        .insert(storeAssets)
        .values({
          storeId: store.id,
          organizationId: store.organizationId,
          storageKey,
          mimeType: image.mimeType,
          bytes: bytes.length,
        })
        .returning({ id: storeAssets.id });
      return asset;
    } catch (error) {
      await storage.remove(storageKey).catch(() => {});
      throw error;
    }
  }
  async privateAsset(userId: string | null, storeId: string, assetId: string) {
    const store = await this.getStore(userId, z.uuid().parse(storeId));
    const [asset] = await this.db
      .select()
      .from(storeAssets)
      .where(
        and(
          eq(storeAssets.storeId, store.id),
          eq(storeAssets.organizationId, store.organizationId),
          eq(storeAssets.id, z.uuid().parse(assetId)),
        ),
      );
    if (!asset) throw new DomainError("NOT_FOUND", "Image not found.");
    return asset;
  }
  async publicAsset(slug: string, assetId: string) {
    const [row] = await this.db
      .select({ asset: storeAssets, settings: stores.publishedSettings })
      .from(stores)
      .innerJoin(
        storeAssets,
        and(
          eq(storeAssets.storeId, stores.id),
          eq(storeAssets.organizationId, stores.organizationId),
        ),
      )
      .where(
        and(
          eq(stores.slug, slug),
          eq(stores.status, "active"),
          isNotNull(stores.settingsPublishedAt),
          eq(storeAssets.id, z.uuid().parse(assetId)),
        ),
      );
    if (
      !row ||
      !assetSlots.some((slot) => row.settings.identity[slot] === assetId)
    )
      throw new DomainError("NOT_FOUND", "Image not published.");
    return row.asset;
  }
}
