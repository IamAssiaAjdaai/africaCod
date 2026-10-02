import type { PageConfig, CheckoutConfiguration } from "@africacod/validation";
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  bigint,
  jsonb,
  foreignKey,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
const dates = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
export const user = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...dates(),
});
export const session = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...dates(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
export const account = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...dates(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    unique("accounts_provider_account_unique").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...dates(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);
export const membershipRole = pgEnum("membership_role", ["owner", "admin"]);
export const storeStatus = pgEnum("store_status", ["active", "inactive"]);
export const marketStatus = pgEnum("market_status", ["active", "inactive"]);
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  ...dates(),
});
export const memberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: membershipRole("role").notNull(),
    ...dates(),
  },
  (t) => [
    unique("membership_org_user_unique").on(t.organizationId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);
export const countryDefinitions = pgTable("country_definitions", {
  code: varchar("code", { length: 2 }).primaryKey(),
  name: text("name").notNull(),
  currencyCode: varchar("currency_code", { length: 3 }).notNull(),
  currencySymbol: text("currency_symbol").notNull(),
  defaultLocale: text("default_locale").notNull(),
  callingCode: text("calling_code"),
});
export const stores = pgTable(
  "stores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 63 }).notNull().unique(),
    logo: text("logo"),
    status: storeStatus("status").default("active").notNull(),
    ...dates(),
  },
  (t) => [
    unique("stores_id_org_unique").on(t.id, t.organizationId),
    index("stores_org_idx").on(t.organizationId),
  ],
);
export const storeMarkets = pgTable(
  "store_markets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    storeId: uuid("store_id").notNull(),
    countryCode: varchar("country_code", { length: 2 }).references(
      () => countryDefinitions.code,
    ),
    name: text("name").notNull(),
    customKey: text("custom_key"),
    callingCode: text("calling_code"),
    checkoutConfig: jsonb("checkout_config").$type<CheckoutConfiguration>(),
    currency: varchar("currency", { length: 3 }).notNull(),
    locale: text("locale").notNull(),
    status: marketStatus("status").default("active").notNull(),
    ...dates(),
  },
  (t) => [
    foreignKey({
      name: "market_store_tenant_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }),
    unique("markets_id_store_org_unique").on(t.id, t.storeId, t.organizationId),
    unique("market_store_country_unique").on(t.storeId, t.countryCode),
    unique("market_store_custom_unique").on(t.storeId, t.customKey),
    check(
      "market_identity_check",
      sql`(${t.countryCode} IS NOT NULL AND ${t.customKey} IS NULL) OR (${t.countryCode} IS NULL AND ${t.customKey} IS NOT NULL AND length(${t.customKey}) > 0)`,
    ),
    index("markets_org_store_idx").on(t.organizationId, t.storeId),
  ],
);

export const productStatus = pgEnum("product_status", [
  "draft",
  "active",
  "archived",
]);
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    storeId: uuid("store_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    parentId: uuid("parent_id"),
    depth: integer("depth").default(0).notNull(),
    parentDepth: integer("parent_depth").default(0).notNull(),
    status: marketStatus("status").default("active").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...dates(),
  },
  (t) => [
    unique("category_store_slug_unique").on(t.storeId, t.slug),
    unique("category_identity_depth_unique").on(
      t.id,
      t.storeId,
      t.organizationId,
      t.depth,
    ),
    unique("category_parent_identity_unique").on(
      t.id,
      t.parentId,
      t.storeId,
      t.organizationId,
    ),
    foreignKey({
      name: "category_store_tenant_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }),
    foreignKey({
      name: "category_parent_top_level_fk",
      columns: [t.parentId, t.storeId, t.organizationId, t.parentDepth],
      foreignColumns: [t.id, t.storeId, t.organizationId, t.depth],
    }),
    check(
      "category_two_levels",
      sql`${t.parentDepth} = 0 AND ((${t.parentId} IS NULL AND ${t.depth} = 0) OR (${t.parentId} IS NOT NULL AND ${t.depth} = 1))`,
    ),
    index("categories_org_store_idx").on(t.organizationId, t.storeId),
  ],
);
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    storeId: uuid("store_id").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    shortDescription: varchar("short_description", { length: 160 }),
    description: text("description"),
    categoryId: uuid("category_id"),
    subcategoryId: uuid("subcategory_id"),
    categoryDepth: integer("category_depth").default(0).notNull(),
    status: productStatus("status").default("draft").notNull(),
    ...dates(),
  },
  (t) => [
    unique("product_store_slug_unique").on(t.storeId, t.slug),
    unique("product_store_sku_unique").on(t.storeId, t.sku),
    unique("product_id_org_unique").on(t.id, t.organizationId),
    unique("product_id_store_org_unique").on(t.id, t.storeId, t.organizationId),
    foreignKey({
      name: "product_store_tenant_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }),
    foreignKey({
      name: "product_category_top_level_fk",
      columns: [t.categoryId, t.storeId, t.organizationId, t.categoryDepth],
      foreignColumns: [
        categories.id,
        categories.storeId,
        categories.organizationId,
        categories.depth,
      ],
    }),
    foreignKey({
      name: "product_subcategory_parent_fk",
      columns: [t.subcategoryId, t.categoryId, t.storeId, t.organizationId],
      foreignColumns: [
        categories.id,
        categories.parentId,
        categories.storeId,
        categories.organizationId,
      ],
    }),
    check(
      "product_category_valid",
      sql`${t.categoryDepth} = 0 AND (${t.subcategoryId} IS NULL OR ${t.categoryId} IS NOT NULL)`,
    ),
    index("products_org_store_idx").on(t.organizationId, t.storeId),
  ],
);
export const productMedia = pgTable(
  "product_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    productId: uuid("product_id").notNull(),
    type: text("type").default("image").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    altText: varchar("alt_text", { length: 200 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: "media_product_tenant_fk",
      columns: [t.productId, t.organizationId],
      foreignColumns: [products.id, products.organizationId],
    }),
    check(
      "media_images_only",
      sql`${t.type} = 'image' AND ${t.mimeType} IN ('image/png', 'image/jpeg', 'image/webp')`,
    ),
    index("media_org_product_idx").on(t.organizationId, t.productId),
  ],
);
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    productId: uuid("product_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    status: marketStatus("status").default("active").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...dates(),
  },
  (t) => [
    foreignKey({
      name: "variant_product_tenant_fk",
      columns: [t.productId, t.organizationId],
      foreignColumns: [products.id, products.organizationId],
    }),
    unique("variant_id_product_org_unique").on(
      t.id,
      t.productId,
      t.organizationId,
    ),
    unique("variant_product_sku_unique").on(t.productId, t.sku),
    index("variants_org_product_idx").on(t.organizationId, t.productId),
  ],
);
export const productMarketOffers = pgTable(
  "product_market_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    productId: uuid("product_id").notNull(),
    storeMarketId: uuid("store_market_id").notNull(),
    priceMinor: bigint("price_minor", { mode: "number" }).notNull(),
    compareAtPriceMinor: bigint("compare_at_price_minor", { mode: "number" }),
    costMinor: bigint("cost_minor", { mode: "number" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: marketStatus("status").default("active").notNull(),
    ...dates(),
  },
  (t) => [
    unique("offer_identity_unique").on(
      t.id,
      t.productId,
      t.storeMarketId,
      t.storeId,
      t.organizationId,
    ),
    unique("offer_product_market_unique").on(t.productId, t.storeMarketId),
    foreignKey({
      name: "offer_product_store_tenant_fk",
      columns: [t.productId, t.storeId, t.organizationId],
      foreignColumns: [products.id, products.storeId, products.organizationId],
    }),
    foreignKey({
      name: "offer_market_store_tenant_fk",
      columns: [t.storeMarketId, t.storeId, t.organizationId],
      foreignColumns: [
        storeMarkets.id,
        storeMarkets.storeId,
        storeMarkets.organizationId,
      ],
    }),
    check(
      "offer_money_valid",
      sql`${t.priceMinor} > 0 AND ${t.priceMinor} <= 9007199254740991 AND (${t.compareAtPriceMinor} IS NULL OR (${t.compareAtPriceMinor} >= ${t.priceMinor} AND ${t.compareAtPriceMinor} <= 9007199254740991)) AND (${t.costMinor} IS NULL OR (${t.costMinor} >= 0 AND ${t.costMinor} <= 9007199254740991))`,
    ),
    index("offers_org_product_idx").on(t.organizationId, t.productId),
  ],
);

export type PublishedPageConfig = PageConfig & {
  productName: string;
  description: string | null;
  media: {
    id: string;
    storageKey: string;
    mimeType: string;
    altText: string | null;
  }[];
};
export const pageStatus = pgEnum("product_page_status", ["draft", "published"]);
export const orderStatus = pgEnum("order_status", ["new", "cancelled"]);
export const productPages = pgTable(
  "product_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    productId: uuid("product_id").notNull().unique(),
    templateKey: text("template_key").default("cod_v1").notNull(),
    status: pageStatus("status").default("draft").notNull(),
    draftConfig: jsonb("draft_config").$type<PageConfig>().notNull(),
    publishedConfig: jsonb("published_config").$type<PublishedPageConfig>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...dates(),
  },
  (t) => [
    foreignKey({
      name: "page_product_tenant_fk",
      columns: [t.productId, t.organizationId],
      foreignColumns: [products.id, products.organizationId],
    }),
    check("page_template_valid", sql`${t.templateKey} = 'cod_v1'`),
    check(
      "published_page_has_content",
      sql`${t.status} <> 'published' OR (${t.publishedConfig} IS NOT NULL AND ${t.publishedAt} IS NOT NULL)`,
    ),
  ],
);
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    normalizedPhone: varchar("normalized_phone", { length: 20 }).notNull(),
    ...dates(),
  },
  (t) => [
    foreignKey({
      name: "customer_store_tenant_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }),
    unique("customer_store_phone_unique").on(t.storeId, t.normalizedPhone),
    unique("customer_identity_unique").on(t.id, t.storeId, t.organizationId),
    check("customer_e164", sql`${t.normalizedPhone} ~ '^[+][1-9][0-9]{6,14}$'`),
  ],
);
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    storeMarketId: uuid("store_market_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    orderNumber: varchar("order_number", { length: 40 }).notNull().unique(),
    checkoutIdempotencyKey: uuid("checkout_idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    countryCode: varchar("country_code", { length: 2 }),
    marketName: text("market_name").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    region: text("region").notNull(),
    city: text("city").notNull(),
    address: text("address").notNull(),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(),
    shippingFeeMinor: bigint("shipping_fee_minor", { mode: "number" })
      .default(0)
      .notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    status: orderStatus("order_status").default("new").notNull(),
    duplicateSignal: boolean("duplicate_signal").default(false).notNull(),
    ...dates(),
  },
  (t) => [
    unique("order_store_idempotency_unique").on(
      t.storeId,
      t.checkoutIdempotencyKey,
    ),
    unique("order_id_org_unique").on(t.id, t.organizationId),
    unique("order_identity_unique").on(
      t.id,
      t.storeId,
      t.storeMarketId,
      t.organizationId,
      t.currency,
    ),
    foreignKey({
      name: "order_market_store_tenant_fk",
      columns: [t.storeMarketId, t.storeId, t.organizationId],
      foreignColumns: [
        storeMarkets.id,
        storeMarkets.storeId,
        storeMarkets.organizationId,
      ],
    }),
    foreignKey({
      name: "order_customer_store_tenant_fk",
      columns: [t.customerId, t.storeId, t.organizationId],
      foreignColumns: [
        customers.id,
        customers.storeId,
        customers.organizationId,
      ],
    }),
    check(
      "order_money_valid",
      sql`${t.subtotalMinor} > 0 AND ${t.shippingFeeMinor} >= 0 AND ${t.totalMinor} = ${t.subtotalMinor} + ${t.shippingFeeMinor} AND ${t.totalMinor} <= 9007199254740991`,
    ),
    index("orders_org_date_idx").on(t.organizationId, t.createdAt),
  ],
);
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    orderId: uuid("order_id").notNull(),
    storeId: uuid("store_id").notNull(),
    storeMarketId: uuid("store_market_id").notNull(),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    offerId: uuid("offer_id").notNull(),
    productName: text("product_name").notNull(),
    variantName: text("variant_name"),
    sku: text("sku"),
    currency: varchar("currency", { length: 3 }).notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }),
    quantity: integer("quantity").notNull(),
    lineTotalMinor: bigint("line_total_minor", { mode: "number" }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "item_order_identity_fk",
      columns: [
        t.orderId,
        t.storeId,
        t.storeMarketId,
        t.organizationId,
        t.currency,
      ],
      foreignColumns: [
        orders.id,
        orders.storeId,
        orders.storeMarketId,
        orders.organizationId,
        orders.currency,
      ],
    }),
    foreignKey({
      name: "item_product_store_fk",
      columns: [t.productId, t.storeId, t.organizationId],
      foreignColumns: [products.id, products.storeId, products.organizationId],
    }),
    foreignKey({
      name: "item_variant_product_fk",
      columns: [t.variantId, t.productId, t.organizationId],
      foreignColumns: [
        productVariants.id,
        productVariants.productId,
        productVariants.organizationId,
      ],
    }),
    foreignKey({
      name: "item_offer_identity_fk",
      columns: [
        t.offerId,
        t.productId,
        t.storeMarketId,
        t.storeId,
        t.organizationId,
      ],
      foreignColumns: [
        productMarketOffers.id,
        productMarketOffers.productId,
        productMarketOffers.storeMarketId,
        productMarketOffers.storeId,
        productMarketOffers.organizationId,
      ],
    }),
    check(
      "item_money_valid",
      sql`${t.quantity} BETWEEN 1 AND 20 AND ${t.unitPriceMinor} > 0 AND (${t.unitCostMinor} IS NULL OR ${t.unitCostMinor} >= 0) AND ${t.lineTotalMinor} = ${t.unitPriceMinor} * ${t.quantity} AND ${t.lineTotalMinor} <= 9007199254740991`,
    ),
  ],
);
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    orderId: uuid("order_id").notNull(),
    status: orderStatus("status").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: "event_order_tenant_fk",
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const orderAttribution = pgTable(
  "order_attribution",
  {
    orderId: uuid("order_id").primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    fbclid: text("fbclid"),
    fbp: text("fbp"),
    fbc: text("fbc"),
    referrer: text("referrer"),
    landingUrl: text("landing_url"),
    userAgent: text("user_agent"),
  },
  (t) => [
    foreignKey({
      name: "attribution_order_tenant_fk",
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
