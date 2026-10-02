import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  categories,
  products,
  productMedia,
  productPages,
  productVariants,
  productMarketOffers,
  storeMarkets,
} from "@africacod/db";
import {
  categoryInput,
  productInput,
  variantInput,
  offerInput,
  mediaUploadInput,
  reorderInput,
} from "@africacod/validation";
import { parseMoney } from "@africacod/shared/money";
import { CommerceService, DomainError } from "./commerce";
import { validateImage, type MediaStorage } from "./media";
function dbCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return dbCode(error.cause);
}
async function write<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (dbCode(error) === "23505")
      throw new DomainError(
        "CONFLICT",
        "This slug, SKU, or market offer already exists in this store.",
      );
    if (["23503", "23514"].includes(dbCode(error) ?? ""))
      throw new DomainError(
        "INVALID_INPUT",
        "These records cannot be linked. Check their store and category relationships.",
      );
    throw error;
  }
}
export class CatalogService extends CommerceService {
  async listCategories(userId: string | null, storeId?: string) {
    const org = await this.tenant(userId);
    if (storeId) await this.getStore(userId, z.uuid().parse(storeId));
    return this.db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.organizationId, org.id),
          storeId ? eq(categories.storeId, storeId) : undefined,
        ),
      )
      .orderBy(asc(categories.sortOrder), asc(categories.name));
  }
  async getCategory(userId: string | null, categoryId: string) {
    const org = await this.tenant(userId);
    const [category] = await this.db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, z.uuid().parse(categoryId)),
          eq(categories.organizationId, org.id),
        ),
      )
      .limit(1);
    if (!category) throw new DomainError("NOT_FOUND", "Category not found.");
    return category;
  }
  private async categoryParent(
    userId: string | null,
    storeId: string,
    parentId: string | null,
    categoryId?: string,
  ) {
    if (!parentId) return;
    const parent = await this.getCategory(userId, parentId);
    if (
      parent.storeId !== storeId ||
      parent.parentId ||
      parent.id === categoryId
    )
      throw new DomainError(
        "INVALID_INPUT",
        "A subcategory must belong to a top-level category in the same store.",
      );
  }
  async createCategory(userId: string | null, input: unknown) {
    const value = categoryInput.parse(input);
    const store = await this.getStore(userId, value.storeId);
    await this.categoryParent(userId, store.id, value.parentId);
    return write(async () => {
      const [category] = await this.db
        .insert(categories)
        .values({
          ...value,
          organizationId: store.organizationId,
          depth: value.parentId ? 1 : 0,
        })
        .returning();
      return category;
    });
  }
  async updateCategory(
    userId: string | null,
    categoryId: string,
    input: unknown,
  ) {
    const category = await this.getCategory(userId, categoryId);
    const value = categoryInput.parse(input);
    if (value.storeId !== category.storeId)
      throw new DomainError(
        "INVALID_INPUT",
        "Categories cannot move between stores.",
      );
    await this.categoryParent(
      userId,
      category.storeId,
      value.parentId,
      category.id,
    );
    return write(async () => {
      const [updated] = await this.db
        .update(categories)
        .set({ ...value, depth: value.parentId ? 1 : 0, updatedAt: new Date() })
        .where(
          and(
            eq(categories.id, category.id),
            eq(categories.organizationId, category.organizationId),
          ),
        )
        .returning();
      return updated;
    });
  }
  async listProducts(userId: string | null, storeId?: string) {
    const org = await this.tenant(userId);
    if (storeId) await this.getStore(userId, z.uuid().parse(storeId));
    return this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.organizationId, org.id),
          storeId ? eq(products.storeId, storeId) : undefined,
        ),
      )
      .orderBy(asc(products.name));
  }
  async getProduct(userId: string | null, productId: string) {
    const org = await this.tenant(userId);
    const [product] = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, z.uuid().parse(productId)),
          eq(products.organizationId, org.id),
        ),
      )
      .limit(1);
    if (!product) throw new DomainError("NOT_FOUND", "Product not found.");
    return product;
  }
  private async productCategories(
    userId: string | null,
    value: z.infer<typeof productInput>,
  ) {
    if (value.subcategoryId && !value.categoryId)
      throw new DomainError("INVALID_INPUT", "Choose a parent category first.");
    if (value.categoryId) {
      const category = await this.getCategory(userId, value.categoryId);
      if (category.storeId !== value.storeId || category.parentId)
        throw new DomainError(
          "INVALID_INPUT",
          "Choose a top-level category in this store.",
        );
    }
    if (value.subcategoryId) {
      const sub = await this.getCategory(userId, value.subcategoryId);
      if (sub.storeId !== value.storeId || sub.parentId !== value.categoryId)
        throw new DomainError(
          "INVALID_INPUT",
          "Choose a subcategory of the selected category.",
        );
    }
  }
  async createProduct(userId: string | null, input: unknown) {
    const value = productInput.parse(input);
    const store = await this.getStore(userId, value.storeId);
    await this.productCategories(userId, value);
    return write(async () => {
      const [product] = await this.db
        .insert(products)
        .values({ ...value, organizationId: store.organizationId })
        .returning();
      return product;
    });
  }
  async updateProduct(
    userId: string | null,
    productId: string,
    input: unknown,
  ) {
    const product = await this.getProduct(userId, productId);
    const value = productInput.parse(input);
    if (value.storeId !== product.storeId)
      throw new DomainError(
        "INVALID_INPUT",
        "Products cannot move between stores.",
      );
    await this.productCategories(userId, value);
    return write(async () => {
      const [updated] = await this.db
        .update(products)
        .set({ ...value, updatedAt: new Date() })
        .where(
          and(
            eq(products.id, product.id),
            eq(products.organizationId, product.organizationId),
          ),
        )
        .returning();
      return updated;
    });
  }
  async listOffers(userId: string | null, productId?: string) {
    const org = await this.tenant(userId);
    if (productId) await this.getProduct(userId, productId);
    return this.db
      .select()
      .from(productMarketOffers)
      .where(
        and(
          eq(productMarketOffers.organizationId, org.id),
          productId ? eq(productMarketOffers.productId, productId) : undefined,
        ),
      );
  }
  private async saveOffer(
    userId: string | null,
    input: unknown,
    offerId?: string,
  ) {
    const value = offerInput.parse(input);
    const product = await this.getProduct(userId, value.productId);
    return write(() =>
      this.db.transaction(async (tx) => {
        const [market] = await tx
          .select()
          .from(storeMarkets)
          .where(
            and(
              eq(storeMarkets.id, value.storeMarketId),
              eq(storeMarkets.storeId, product.storeId),
              eq(storeMarkets.organizationId, product.organizationId),
            ),
          )
          .for("share")
          .limit(1);
        if (!market)
          throw new DomainError(
            "NOT_FOUND",
            "Add this market to the product’s store before configuring an offer.",
          );
        if (market.status !== "active" && value.status === "active")
          throw new DomainError(
            "INVALID_INPUT",
            "Activate the store market before activating an offer.",
          );
        let priceMinor: number,
          compareAtPriceMinor: number | null,
          costMinor: number | null;
        try {
          priceMinor = parseMoney(value.price, market.currency);
          compareAtPriceMinor =
            value.compareAtPrice === null
              ? null
              : parseMoney(value.compareAtPrice, market.currency);
          costMinor =
            value.cost === null
              ? null
              : parseMoney(value.cost, market.currency);
        } catch (error) {
          throw new DomainError(
            "INVALID_INPUT",
            error instanceof Error ? error.message : "Invalid money.",
          );
        }
        if (priceMinor <= 0)
          throw new DomainError(
            "INVALID_INPUT",
            "Price must be greater than zero.",
          );
        if (compareAtPriceMinor !== null && compareAtPriceMinor < priceMinor)
          throw new DomainError(
            "INVALID_INPUT",
            "Compare-at price must be at least the selling price.",
          );
        const fields = {
          priceMinor,
          compareAtPriceMinor,
          costMinor,
          currency: market.currency,
          status: value.status,
          updatedAt: new Date(),
        };
        if (offerId) {
          const [updated] = await tx
            .update(productMarketOffers)
            .set(fields)
            .where(
              and(
                eq(productMarketOffers.id, z.uuid().parse(offerId)),
                eq(productMarketOffers.productId, product.id),
                eq(productMarketOffers.storeMarketId, market.id),
                eq(productMarketOffers.organizationId, product.organizationId),
              ),
            )
            .returning();
          if (!updated) throw new DomainError("NOT_FOUND", "Offer not found.");
          return updated;
        }
        const [offer] = await tx
          .insert(productMarketOffers)
          .values({
            ...fields,
            organizationId: product.organizationId,
            storeId: product.storeId,
            productId: product.id,
            storeMarketId: market.id,
          })
          .returning();
        return offer;
      }),
    );
  }
  async createOffer(userId: string | null, input: unknown) {
    return this.saveOffer(userId, input);
  }
  async updateOffer(userId: string | null, offerId: string, input: unknown) {
    return this.saveOffer(userId, input, offerId);
  }
  async listVariants(userId: string | null, productId: string) {
    const product = await this.getProduct(userId, productId);
    return this.db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, product.id),
          eq(productVariants.organizationId, product.organizationId),
        ),
      )
      .orderBy(asc(productVariants.sortOrder), asc(productVariants.createdAt));
  }
  async createVariant(userId: string | null, input: unknown) {
    const value = variantInput.parse(input);
    const product = await this.getProduct(userId, value.productId);
    return write(async () => {
      const [variant] = await this.db
        .insert(productVariants)
        .values({ ...value, organizationId: product.organizationId })
        .returning();
      return variant;
    });
  }
  async updateVariant(
    userId: string | null,
    variantId: string,
    input: unknown,
  ) {
    const value = variantInput.parse(input);
    const product = await this.getProduct(userId, value.productId);
    return write(async () => {
      const [variant] = await this.db
        .update(productVariants)
        .set({
          name: value.name,
          sku: value.sku,
          status: value.status,
          sortOrder: value.sortOrder,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productVariants.id, z.uuid().parse(variantId)),
            eq(productVariants.productId, product.id),
            eq(productVariants.organizationId, product.organizationId),
          ),
        )
        .returning();
      if (!variant) throw new DomainError("NOT_FOUND", "Variant not found.");
      return variant;
    });
  }
  async listMedia(userId: string | null, productId?: string) {
    const org = await this.tenant(userId);
    if (productId) await this.getProduct(userId, productId);
    return this.db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.organizationId, org.id),
          productId ? eq(productMedia.productId, productId) : undefined,
        ),
      )
      .orderBy(asc(productMedia.sortOrder), asc(productMedia.createdAt));
  }
  async getMedia(userId: string | null, mediaId: string) {
    const org = await this.tenant(userId);
    const [media] = await this.db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.id, z.uuid().parse(mediaId)),
          eq(productMedia.organizationId, org.id),
        ),
      )
      .limit(1);
    if (!media) throw new DomainError("NOT_FOUND", "Image not found.");
    return media;
  }
  async uploadMedia(
    userId: string | null,
    input: unknown,
    bytes: Uint8Array,
    mimeType: string,
    storage: MediaStorage,
  ) {
    const value = mediaUploadInput.parse(input);
    const product = await this.getProduct(userId, value.productId);
    let image;
    try {
      image = validateImage(bytes, mimeType);
    } catch (error) {
      throw new DomainError(
        "INVALID_INPUT",
        error instanceof Error ? error.message : "Invalid image.",
      );
    }
    const key = `${crypto.randomUUID()}.${image.extension}`;
    await storage.put(key, bytes, image.mimeType);
    try {
      // Allocate order under the product lock so simultaneous uploads stay deterministic.
      return await this.db.transaction(async (tx) => {
        await tx
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.id, product.id),
              eq(products.organizationId, product.organizationId),
            ),
          )
          .for("update");
        const [position] = await tx
          .select({
            next: sql<number>`coalesce(max(${productMedia.sortOrder}), -1) + 1`,
          })
          .from(productMedia)
          .where(eq(productMedia.productId, product.id));
        const [media] = await tx
          .insert(productMedia)
          .values({
            ...value,
            organizationId: product.organizationId,
            storageKey: key,
            mimeType: image.mimeType,
            sortOrder: position.next,
          })
          .returning();
        return media;
      });
    } catch (error) {
      await storage.remove(key);
      throw error;
    }
  }
  async removeMedia(
    userId: string | null,
    mediaId: string,
    storage: MediaStorage,
  ) {
    const media = await this.getMedia(userId, mediaId);
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.id, media.productId),
            eq(products.organizationId, media.organizationId),
          ),
        )
        .for("update");
      const [page] = await tx
        .select()
        .from(productPages)
        .where(
          and(
            eq(productPages.productId, media.productId),
            eq(productPages.organizationId, media.organizationId),
          ),
        );
      if (
        page?.status === "published" &&
        page.publishedConfig?.media.some((image) => image.id === media.id)
      )
        throw new DomainError(
          "CONFLICT",
          "This image is published. Publish a draft without it, or unpublish the page before removing it.",
        );
      await tx
        .delete(productMedia)
        .where(
          and(
            eq(productMedia.id, media.id),
            eq(productMedia.organizationId, media.organizationId),
          ),
        );
    });
    // A failed physical cleanup leaves an inaccessible orphan, never a broken visible record.
    try {
      await storage.remove(media.storageKey);
    } catch (error) {
      console.error("Media cleanup failed", error);
    }
  }
  async reorderMedia(userId: string | null, input: unknown) {
    const value = reorderInput.parse(input);
    const product = await this.getProduct(userId, value.productId);
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.id, product.id),
            eq(products.organizationId, product.organizationId),
          ),
        )
        .for("update");
      const rows = await tx
        .select()
        .from(productMedia)
        .where(
          and(
            eq(productMedia.productId, product.id),
            eq(productMedia.organizationId, product.organizationId),
          ),
        );
      if (
        value.ids.length !== rows.length ||
        new Set(value.ids).size !== rows.length ||
        rows.some((row) => !value.ids.includes(row.id))
      )
        throw new DomainError(
          "INVALID_INPUT",
          "Reorder exactly this product’s images.",
        );
      for (const [sortOrder, id] of value.ids.entries())
        await tx
          .update(productMedia)
          .set({ sortOrder })
          .where(
            and(
              eq(productMedia.id, id),
              eq(productMedia.organizationId, product.organizationId),
            ),
          );
    });
  }
  async productListData(userId: string | null) {
    const [productRows, categoryRows, offers, media] = await Promise.all([
      this.listProducts(userId),
      this.listCategories(userId),
      this.listOffers(userId),
      this.listMedia(userId),
    ]);
    const org = await this.tenant(userId);
    const markets = await this.db
      .select()
      .from(storeMarkets)
      .where(eq(storeMarkets.organizationId, org.id));
    return {
      products: productRows,
      categories: categoryRows,
      offers,
      media,
      markets,
    };
  }
}
