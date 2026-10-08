import { StoreSettingsService } from "./store-settings";
import { and, asc, desc, eq, sql, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import {
  stores,
  contentPages,
  storeMarkets,
  products,
  productPages,
  productMarketOffers,
  categories,
} from "@africacod/db";
import {
  contentPageInput,
  brandingInput,
  type PublishedContent,
  storeSettingsInput,
  type StoreSettings,
} from "@africacod/validation";
import { currencyDecimals } from "@africacod/shared/money";
import { StorefrontService, marketToken } from "./storefront";
import { DomainError } from "./commerce";
import { type MediaStorage } from "./media";
function conflict(error: unknown): never {
  if (error && typeof error === "object") {
    if ("code" in error && error.code === "23505")
      throw new DomainError(
        "CONFLICT",
        "This page address is already used in this store.",
      );
    if ("cause" in error) return conflict(error.cause);
  }
  throw error;
}
function snapshot(page: typeof contentPages.$inferSelect): PublishedContent {
  return {
    title: page.title,
    slug: page.slug,
    content: page.draftContent,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    showInNavigation: page.showInNavigation,
    navigationLabel: page.navigationLabel,
    navigationOrder: page.navigationOrder,
  };
}
export class ContentService extends StorefrontService {
  async listContentPages(userId: string | null, storeId?: string) {
    const org = await this.tenant(userId);
    if (storeId) await this.getStore(userId, z.uuid().parse(storeId));
    return this.db
      .select()
      .from(contentPages)
      .where(
        and(
          eq(contentPages.organizationId, org.id),
          storeId ? eq(contentPages.storeId, storeId) : undefined,
        ),
      )
      .orderBy(desc(contentPages.updatedAt));
  }
  async getContentPage(userId: string | null, id: string) {
    const org = await this.tenant(userId);
    const [page] = await this.db
      .select()
      .from(contentPages)
      .where(
        and(
          eq(contentPages.id, z.uuid().parse(id)),
          eq(contentPages.organizationId, org.id),
        ),
      )
      .limit(1);
    if (!page) throw new DomainError("NOT_FOUND", "Page not found.");
    return page;
  }
  async saveContentPage(
    userId: string | null,
    id: string | null,
    input: unknown,
  ) {
    const value = contentPageInput.parse(input);
    const store = await this.getStore(userId, value.storeId);
    if (id) {
      const existing = await this.getContentPage(userId, id);
      if (existing.storeId !== store.id)
        throw new DomainError(
          "INVALID_INPUT",
          "Pages cannot move between stores.",
        );
    }
    const { content, ...draft } = value;
    try {
      const [page] = id
        ? await this.db
            .update(contentPages)
            .set({ ...draft, draftContent: content, updatedAt: new Date() })
            .where(
              and(
                eq(contentPages.id, id),
                eq(contentPages.organizationId, store.organizationId),
              ),
            )
            .returning()
        : await this.db
            .insert(contentPages)
            .values({
              ...draft,
              draftContent: content,
              organizationId: store.organizationId,
            })
            .returning();
      return page;
    } catch (error) {
      return conflict(error);
    }
  }
  async publishContentPage(userId: string | null, id: string) {
    const page = await this.getContentPage(userId, id);
    try {
      return await this.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(contentPages)
          .where(
            and(
              eq(contentPages.id, page.id),
              eq(contentPages.organizationId, page.organizationId),
            ),
          )
          .for("update");
        const [store] = await tx
          .select()
          .from(stores)
          .where(
            and(
              eq(stores.id, page.storeId),
              eq(stores.organizationId, page.organizationId),
            ),
          )
          .for("share");
        if (store.status !== "active" || !current.draftContent.trim())
          throw new DomainError(
            "INVALID_INPUT",
            "Use an active store and add content before publishing.",
          );
        const [published] = await tx
          .update(contentPages)
          .set({
            status: "published",
            publishedContent: snapshot(current),
            publishedSlug: current.slug,
            publishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(contentPages.id, current.id))
          .returning();
        return published;
      });
    } catch (error) {
      return conflict(error);
    }
  }
  async unpublishContentPage(userId: string | null, id: string) {
    const page = await this.getContentPage(userId, id);
    await this.db
      .update(contentPages)
      .set({ status: "draft", publishedSlug: null, updatedAt: new Date() })
      .where(
        and(
          eq(contentPages.id, page.id),
          eq(contentPages.organizationId, page.organizationId),
        ),
      );
  }
  async updateBranding(userId: string | null, storeId: string, input: unknown) {
    const store = await this.getStore(userId, z.uuid().parse(storeId));
    const value = brandingInput.parse(input);
    const settingsService = new StoreSettingsService(this.db);
    await settingsService.saveDraft(
      userId,
      storeId,
      {
        ...store.draftSettings,
        identity: { ...store.draftSettings.identity, ...value },
      },
      store.settingsRevision,
    );
    return this.getStore(userId, storeId);
  }
  async uploadStoreLogo(
    userId: string | null,
    storeId: string,
    bytes: Uint8Array,
    mimeType: string,
    storage: MediaStorage,
  ) {
    const store = await this.getStore(userId, z.uuid().parse(storeId));
    const settingsService = new StoreSettingsService(this.db);
    let asset;
    try {
      asset = await settingsService.uploadAsset(
        userId,
        storeId,
        bytes,
        mimeType,
        storage,
      );
    } catch (error) {
      throw new DomainError(
        "INVALID_INPUT",
        error instanceof Error ? error.message : "Invalid image.",
      );
    }
    await settingsService.saveDraft(
      userId,
      storeId,
      {
        ...store.draftSettings,
        identity: { ...store.draftSettings.identity, logoLight: asset.id },
      },
      store.settingsRevision,
    );
  }
  async getPublicLogo(storeSlug: string) {
    const [store] = await this.db
      .select({ settings: stores.publishedSettings })
      .from(stores)
      .where(and(eq(stores.slug, storeSlug), eq(stores.status, "active")))
      .limit(1);
    if (store?.settings.identity.logoLight)
      return new StoreSettingsService(this.db).publicAsset(
        storeSlug,
        store.settings.identity.logoLight,
      );
    throw new DomainError("NOT_FOUND", "Logo not found.");
  }

  async getPublicStore(storeSlug: string, previewUser?: string) {
    const [store] = await this.db
      .select()
      .from(stores)
      .where(and(eq(stores.slug, storeSlug), eq(stores.status, "active")))
      .limit(1);
    if (!store || (!previewUser && !store.settingsPublishedAt))
      throw new DomainError("NOT_FOUND", "Store not found.");
    if (previewUser) await this.getStore(previewUser, store.id);
    const settings = storeSettingsInput.parse(
      previewUser ? store.draftSettings : store.publishedSettings,
    );
    const [markets, pages, categoryRows] = await Promise.all([
      this.db
        .select({
          countryCode: storeMarkets.countryCode,
          customKey: storeMarkets.customKey,
          name: storeMarkets.name,
          currency: storeMarkets.currency,
          locale: storeMarkets.locale,
        })
        .from(storeMarkets)
        .where(
          and(
            eq(storeMarkets.storeId, store.id),
            eq(storeMarkets.organizationId, store.organizationId),
            eq(storeMarkets.status, "active"),
          ),
        )
        .orderBy(asc(storeMarkets.name)),
      this.db
        .select({ id: contentPages.id, content: contentPages.publishedContent })
        .from(contentPages)
        .where(
          and(
            eq(contentPages.storeId, store.id),
            eq(contentPages.organizationId, store.organizationId),
            eq(contentPages.status, "published"),
          ),
        ),
      this.db
        .select({
          id: categories.id,
          parentId: categories.parentId,
          name: categories.name,
          slug: categories.slug,
          status: categories.status,
          sortOrder: categories.sortOrder,
        })
        .from(categories)
        .where(
          and(
            eq(categories.storeId, store.id),
            eq(categories.organizationId, store.organizationId),
          ),
        )
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
    ]);
    const base = `/s/${store.slug}`;
    const targetUrl = (
      target: StoreSettings["navigation"]["cta"]["target"],
    ): string | null => {
      switch (target.kind) {
        case "home":
          return base;
        case "products":
          return `${base}/products`;
        case "url":
          return target.url;
        case "category": {
          const category = categoryRows.find(
            (c) =>
              c.id === target.id &&
              c.status === "active" &&
              (!c.parentId ||
                categoryRows.some(
                  (p) => p.id === c.parentId && p.status === "active",
                )),
          );
          return category ? `${base}/category/${category.slug}` : null;
        }
        case "page": {
          const page = pages.find((p) => p.id === target.id && p.content);
          return page ? `${base}/pages/${page.content!.slug}` : null;
        }
      }
    };
    const resolveLinks = (links: StoreSettings["navigation"]["header"]) =>
      links.flatMap((l) => {
        const url = targetUrl(l.target);
        return url ? [{ id: l.id, label: l.label, url }] : [];
      });
    const assetUrl = (id: string | null) =>
      id
        ? previewUser
          ? `/api/stores/${store.id}/assets/${id}`
          : `${base}/assets/${id}`
        : null;
    return {
      settings: {
        ...settings,
        identity: {
          ...settings.identity,
          logoLight: assetUrl(settings.identity.logoLight),
          logoDark: assetUrl(settings.identity.logoDark),
          favicon: assetUrl(settings.identity.favicon),
          heroLight: assetUrl(settings.identity.heroLight),
          heroDark: assetUrl(settings.identity.heroDark),
        },
        navigation: {
          ...settings.navigation,
          header: resolveLinks(settings.navigation.header),
          footer: resolveLinks(settings.navigation.footer),
          cta: {
            enabled: settings.navigation.cta.enabled,
            label: settings.navigation.cta.label,
            url: targetUrl(settings.navigation.cta.target),
          },
        },
      },
      name: settings.identity.name ?? store.name,
      slug: store.slug,
      tagline: settings.identity.tagline,
      logoUrl:
        assetUrl(settings.identity.logoLight) ??
        (store.logo && !store.settingsPublishedAt
          ? `/s/${store.slug}/logo`
          : null),
      contactEmail: settings.identity.contactEmail,
      contactPhone: settings.identity.contactPhone,
      markets: markets
        .filter((m) => {
          try {
            currencyDecimals(m.currency);
            return true;
          } catch {
            return false;
          }
        })
        .map((m) => ({
          token: marketToken(m),
          name: m.name,
          currency: m.currency,
          locale: m.locale,
        })),
      pages: pages
        .flatMap((p) =>
          p.content?.showInNavigation
            ? [
                {
                  slug: p.content.slug,
                  label: p.content.navigationLabel || p.content.title,
                  order: p.content.navigationOrder,
                },
              ]
            : [],
        )
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
      categories: categoryRows
        .filter(
          (c) =>
            c.status === "active" &&
            (!c.parentId ||
              categoryRows.some(
                (p) => p.id === c.parentId && p.status === "active",
              )),
        )
        .map((c) => ({
          slug: c.slug,
          name: c.name,
          parentSlug:
            categoryRows.find((p) => p.id === c.parentId)?.slug ?? null,
        })),
    };
  }
  async getPublicContentPage(
    storeSlug: string,
    pageSlug: string,
    previewUser?: string,
  ) {
    if (previewUser) await this.getPublicStore(storeSlug, previewUser);
    const [row] = await this.db
      .select({ content: contentPages.publishedContent })
      .from(stores)
      .innerJoin(
        contentPages,
        and(
          eq(contentPages.storeId, stores.id),
          eq(contentPages.organizationId, stores.organizationId),
        ),
      )
      .where(
        and(
          eq(stores.slug, storeSlug),
          eq(stores.status, "active"),
          previewUser ? undefined : isNotNull(stores.settingsPublishedAt),
          eq(contentPages.status, "published"),
          eq(contentPages.publishedSlug, pageSlug),
        ),
      )
      .limit(1);
    if (!row?.content) throw new DomainError("NOT_FOUND", "Page not found.");
    const { title, content, metaTitle, metaDescription } = row.content;
    return { title, content, metaTitle, metaDescription };
  }
  async browseStore(
    storeSlug: string,
    requestedMarket?: string,
    categorySlug?: string,
    page = 1,
    previewUser?: string,
    featured = false,
  ) {
    const store = await this.getPublicStore(storeSlug, previewUser);
    const selected =
      requestedMarket !== undefined
        ? store.markets.find((m) => m.token === requestedMarket)
        : previewUser || store.markets.length === 1
          ? store.markets[0]
          : undefined;
    const category = categorySlug
      ? store.categories.find((c) => c.slug === categorySlug)
      : undefined;
    if (categorySlug && !category)
      throw new DomainError("NOT_FOUND", "Category not found.");
    if (!selected)
      return {
        store,
        selected: null,
        invalidMarket: requestedMarket !== undefined,
        products: [],
        category: category ?? null,
        page: 1,
        hasNext: false,
      };
    const currentPage = z.number().int().min(1).max(10000).parse(page);
    const rows = await this.db
      .select({
        config: productPages.publishedConfig,
        slug: products.slug,
        priceMinor: productMarketOffers.priceMinor,
        compareAtPriceMinor: productMarketOffers.compareAtPriceMinor,
        currency: productMarketOffers.currency,
        categoryName: categories.name,
      })
      .from(stores)
      .innerJoin(
        products,
        and(
          eq(products.storeId, stores.id),
          eq(products.organizationId, stores.organizationId),
        ),
      )
      .innerJoin(
        productPages,
        and(
          eq(productPages.productId, products.id),
          eq(productPages.organizationId, stores.organizationId),
        ),
      )
      .innerJoin(
        storeMarkets,
        and(
          eq(storeMarkets.storeId, stores.id),
          eq(storeMarkets.organizationId, stores.organizationId),
        ),
      )
      .innerJoin(
        productMarketOffers,
        and(
          eq(productMarketOffers.productId, products.id),
          eq(productMarketOffers.storeId, stores.id),
          eq(productMarketOffers.organizationId, stores.organizationId),
          eq(productMarketOffers.storeMarketId, storeMarkets.id),
        ),
      )
      .leftJoin(
        categories,
        and(
          eq(categories.id, products.categoryId),
          eq(categories.organizationId, stores.organizationId),
          eq(categories.status, "active"),
        ),
      )
      .where(
        and(
          eq(stores.slug, storeSlug),
          eq(stores.status, "active"),
          eq(products.status, "active"),
          eq(productPages.status, "published"),
          eq(storeMarkets.status, "active"),
          eq(productMarketOffers.status, "active"),
          eq(productMarketOffers.currency, storeMarkets.currency),
          selected.token.startsWith("custom:")
            ? eq(storeMarkets.customKey, selected.token.slice(7))
            : eq(storeMarkets.countryCode, selected.token),
          featured && store.settings.featured.mode === "manual"
            ? store.settings.featured.productIds.length
              ? inArray(products.id, store.settings.featured.productIds)
              : sql`false`
            : undefined,
          featured && store.settings.featured.mode === "category"
            ? sql`EXISTS (SELECT 1 FROM categories fc WHERE fc.id = ${store.settings.featured.categoryId} AND fc.store_id = ${stores.id} AND fc.organization_id = ${stores.organizationId} AND fc.status = 'active' AND (fc.parent_id IS NULL OR EXISTS (SELECT 1 FROM categories fp WHERE fp.id = fc.parent_id AND fp.status = 'active' AND fp.store_id = fc.store_id AND fp.organization_id = fc.organization_id))) AND (${products.categoryId} = ${store.settings.featured.categoryId} OR ${products.subcategoryId} = ${store.settings.featured.categoryId})`
            : undefined,
          category
            ? sql`(${products.categoryId} IN (SELECT id FROM categories WHERE store_id = ${stores.id} AND slug = ${category.slug}) OR ${products.subcategoryId} IN (SELECT id FROM categories WHERE store_id = ${stores.id} AND slug = ${category.slug}))`
            : undefined,
        ),
      )
      .orderBy(asc(products.createdAt), asc(products.id))
      .limit(25)
      .offset((currentPage - 1) * 24);
    return {
      store,
      selected,
      invalidMarket: false,
      category: category ?? null,
      page: currentPage,
      hasNext: rows.length > 24,
      products: rows.slice(0, 24).flatMap((row) =>
        row.config
          ? [
              {
                name: row.config.productName,
                slug: row.slug,
                subtitle: row.config.subtitle,
                imageUrl: row.config.media[0]
                  ? previewUser
                    ? `/api/media/${row.config.media[0].id}`
                    : `/s/${storeSlug}/p/${row.slug}/media/${row.config.media[0].id}`
                  : null,
                imageAlt:
                  row.config.media[0]?.altText ?? row.config.productName,
                priceMinor: row.priceMinor,
                compareAtPriceMinor: row.compareAtPriceMinor,
                currency: row.currency,
                categoryName: row.categoryName,
              },
            ]
          : [],
      ),
    };
  }
}
export type PublicStore = Awaited<ReturnType<ContentService["getPublicStore"]>>;
