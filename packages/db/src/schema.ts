import type {
  PageConfig,
  CheckoutConfiguration,
  PublishedContent,
  StoreSettings,
  OrderFieldSnapshot,
} from "@africacod/validation";
import { defaultStoreSettings } from "@africacod/validation";
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
    unique("membership_id_org_unique").on(t.id, t.organizationId),
    index("memberships_user_idx").on(t.userId),
  ],
);
export const countryDefinitions = pgTable("country_definitions", {
  continent: varchar("continent", { length: 2 }),
  merchantMarketEnabled: boolean("merchant_market_enabled")
    .default(false)
    .notNull(),
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
    draftSettings: jsonb("draft_settings")
      .$type<StoreSettings>()
      .notNull()
      .default(defaultStoreSettings()),
    publishedSettings: jsonb("published_settings")
      .$type<StoreSettings>()
      .notNull()
      .default(defaultStoreSettings()),
    settingsRevision: integer("settings_revision").notNull().default(0),
    publishedRevision: integer("published_revision").notNull().default(0),
    settingsPublishedAt: timestamp("settings_published_at", {
      withTimezone: true,
    }),
    logo: text("logo"),
    tagline: varchar("tagline", { length: 200 }),
    contactEmail: varchar("contact_email", { length: 200 }),
    contactPhone: varchar("contact_phone", { length: 40 }),
    status: storeStatus("status").default("active").notNull(),
    ...dates(),
  },
  (t) => [
    check(
      "store_settings_revisions_valid",
      sql`${t.settingsRevision} >= 0 AND ${t.publishedRevision} >= 0 AND ${t.publishedRevision} <= ${t.settingsRevision}`,
    ),
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
export const orderStatus = pgEnum("order_status", [
  "new",
  "confirmed",
  "cancelled",
]);
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
    customFieldSnapshots: jsonb("custom_field_snapshots")
      .$type<OrderFieldSnapshot[]>()
      .notNull()
      .default([]),
    whatsapp: text("whatsapp").notNull().default(""),
    notes: text("notes").notNull().default(""),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(),
    shippingFeeMinor: bigint("shipping_fee_minor", { mode: "number" })
      .default(0)
      .notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    status: orderStatus("order_status").default("new").notNull(),
    assignedMembershipId: uuid("assigned_membership_id"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    duplicateSignal: boolean("duplicate_signal").default(false).notNull(),
    ...dates(),
  },
  (t) => [
    check(
      "order_custom_fields_bounded",
      sql`jsonb_typeof(${t.customFieldSnapshots}) = 'array' AND jsonb_array_length(${t.customFieldSnapshots}) <= 8`,
    ),
    unique("order_store_idempotency_unique").on(
      t.storeId,
      t.checkoutIdempotencyKey,
    ),
    unique("order_id_org_unique").on(t.id, t.organizationId),
    foreignKey({
      name: "order_assignment_tenant_fk",
      columns: [t.assignedMembershipId, t.organizationId],
      foreignColumns: [memberships.id, memberships.organizationId],
    }),
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
    index("orders_org_store_date_idx").on(
      t.organizationId,
      t.storeId,
      t.createdAt,
    ),
    index("orders_org_market_date_idx").on(
      t.organizationId,
      t.storeMarketId,
      t.createdAt,
    ),
    index("orders_org_status_date_idx").on(
      t.organizationId,
      t.status,
      t.createdAt,
    ),
    index("orders_store_phone_date_idx").on(t.storeId, t.phone, t.createdAt),
    index("orders_org_agent_date_idx").on(
      t.organizationId,
      t.assignedMembershipId,
      t.createdAt,
    ),
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
    index("items_order_idx").on(t.orderId),
    index("items_org_product_order_idx").on(
      t.organizationId,
      t.productId,
      t.orderId,
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
    marketingConsent: boolean("marketing_consent").default(false).notNull(),
  },
  (t) => [
    foreignKey({
      name: "attribution_order_tenant_fk",
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);

export const contentPageStatus = pgEnum("content_page_status", [
  "draft",
  "published",
]);
export const contentPages = pgTable(
  "content_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    storeId: uuid("store_id").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    status: contentPageStatus("status").default("draft").notNull(),
    draftContent: text("draft_content").default("").notNull(),
    publishedContent: jsonb("published_content").$type<PublishedContent>(),
    publishedSlug: varchar("published_slug", { length: 100 }),
    metaTitle: varchar("meta_title", { length: 200 }),
    metaDescription: varchar("meta_description", { length: 500 }),
    showInNavigation: boolean("show_in_navigation").default(false).notNull(),
    navigationLabel: varchar("navigation_label", { length: 60 }),
    navigationOrder: integer("navigation_order").default(0).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...dates(),
  },
  (t) => [
    unique("content_page_store_slug_unique").on(t.storeId, t.slug),
    unique("content_page_published_slug_unique").on(t.storeId, t.publishedSlug),
    foreignKey({
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
      name: "content_page_store_org_fk",
    }),
    check(
      "content_page_published_snapshot_check",
      sql`${t.status} <> 'published' OR (${t.publishedContent} IS NOT NULL AND ${t.publishedSlug} IS NOT NULL AND ${t.publishedAt} IS NOT NULL)`,
    ),
    check(
      "content_page_navigation_order_check",
      sql`${t.navigationOrder} BETWEEN 0 AND 1000`,
    ),
    index("content_page_org_idx").on(t.organizationId, t.storeId),
  ],
);

export const confirmationOutcome = pgEnum("confirmation_outcome", [
  "no_answer",
  "callback",
  "confirmed",
  "cancelled",
  "invalid_order",
]);
export const fulfillmentStatus = pgEnum("fulfillment_status", [
  "pending",
  "ready",
  "processing",
  "fulfilled",
  "failed",
  "cancelled",
]);
export const shipmentStatus = pgEnum("shipment_status", [
  "created",
  "shipped",
  "out_for_delivery",
  "delivery_failed",
  "delivered",
  "refused",
  "returned",
  "cancelled",
]);
export const confirmationAttempts = pgTable(
  "confirmation_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    orderId: uuid("order_id").notNull(),
    agentMembershipId: uuid("agent_membership_id").notNull(),
    requestKey: uuid("request_key").notNull(),
    requestHash: text("request_hash").notNull(),
    outcome: confirmationOutcome("outcome").notNull(),
    note: text("note"),
    nextCallbackAt: timestamp("next_callback_at", { withTimezone: true }),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("attempt_order_request_unique").on(t.orderId, t.requestKey),
    foreignKey({
      name: "attempt_order_tenant_fk",
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
    foreignKey({
      name: "attempt_agent_tenant_fk",
      columns: [t.agentMembershipId, t.organizationId],
      foreignColumns: [memberships.id, memberships.organizationId],
    }),
    check(
      "callback_requires_time",
      sql`${t.outcome} <> 'callback' OR ${t.nextCallbackAt} IS NOT NULL`,
    ),
    index("attempt_order_time_idx").on(t.orderId, t.attemptedAt),
    index("attempt_callback_due_idx")
      .on(t.organizationId, t.nextCallbackAt)
      .where(sql`${t.nextCallbackAt} IS NOT NULL`),
  ],
);
export const fulfillments = pgTable(
  "fulfillments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    orderId: uuid("order_id").notNull().unique(),
    status: fulfillmentStatus("status").default("pending").notNull(),
    mode: text("mode").default("manual").notNull(),
    providerConnectionId: uuid("provider_connection_id"),
    ...dates(),
  },
  (t) => [
    unique("fulfillment_identity_unique").on(t.id, t.orderId, t.organizationId),
    foreignKey({
      name: "fulfillment_order_tenant_fk",
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
    foreignKey({
      name: "fulfillment_provider_tenant_fk",
      columns: [t.providerConnectionId, t.organizationId],
      foreignColumns: [
        providerConnections.id,
        providerConnections.organizationId,
      ],
    }),
    check(
      "fulfillment_manual_mode",
      sql`(${t.mode} = 'manual' AND ${t.providerConnectionId} IS NULL) OR (${t.mode} = 'provider' AND ${t.providerConnectionId} IS NOT NULL)`,
    ),
  ],
);
export const fulfillmentStateEvents = pgTable(
  "fulfillment_state_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    orderId: uuid("order_id").notNull(),
    fulfillmentId: uuid("fulfillment_id").notNull(),
    fromStatus: fulfillmentStatus("from_status"),
    toStatus: fulfillmentStatus("to_status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: "fulfillment_event_identity_fk",
      columns: [t.fulfillmentId, t.orderId, t.organizationId],
      foreignColumns: [
        fulfillments.id,
        fulfillments.orderId,
        fulfillments.organizationId,
      ],
    }),
  ],
);
export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    orderId: uuid("order_id").notNull().unique(),
    fulfillmentId: uuid("fulfillment_id").notNull().unique(),
    providerKey: text("provider_key").default("manual").notNull(),
    providerConnectionId: uuid("provider_connection_id"),
    providerRawStatus: text("provider_raw_status"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    integrationError: text("integration_error"),
    providerShipmentId: text("provider_shipment_id"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    status: shipmentStatus("shipment_status").default("created").notNull(),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    ...dates(),
  },
  (t) => [
    index("shipments_org_delivered_date_idx")
      .on(t.organizationId, t.deliveredAt)
      .where(sql`${t.status} = 'delivered'`),
    unique("shipment_id_org_unique").on(t.id, t.organizationId),
    unique("shipment_provider_external_unique").on(
      t.providerConnectionId,
      t.providerShipmentId,
    ),
    foreignKey({
      name: "shipment_provider_tenant_fk",
      columns: [t.providerConnectionId, t.organizationId],
      foreignColumns: [
        providerConnections.id,
        providerConnections.organizationId,
      ],
    }),
    foreignKey({
      name: "shipment_fulfillment_order_tenant_fk",
      columns: [t.fulfillmentId, t.orderId, t.organizationId],
      foreignColumns: [
        fulfillments.id,
        fulfillments.orderId,
        fulfillments.organizationId,
      ],
    }),
    check(
      "manual_shipment_provider",
      sql`(${t.providerKey} = 'manual' AND ${t.providerShipmentId} IS NULL AND ${t.providerConnectionId} IS NULL) OR (${t.providerKey} = 'shipcod' AND ${t.providerShipmentId} IS NOT NULL AND ${t.providerConnectionId} IS NOT NULL)`,
    ),
  ],
);
export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    shipmentId: uuid("shipment_id").notNull(),
    source: text("source").default("manual").notNull(),
    fromStatus: shipmentStatus("from_status"),
    toStatus: shipmentStatus("to_status").notNull(),
    providerStatusRaw: text("provider_status_raw"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: "shipment_event_tenant_fk",
      columns: [t.shipmentId, t.organizationId],
      foreignColumns: [shipments.id, shipments.organizationId],
    }),
    check(
      "shipment_event_manual_source",
      sql`${t.source} IN ('manual','poll')`,
    ),
  ],
);

export const providerConnections = pgTable(
  "provider_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    providerKey: text("provider_key").notNull(),
    adapterMode: text("adapter_mode").notNull(),
    credentialsEncrypted: text("credentials_encrypted").notNull(),
    status: text("status").default("not_connected").notNull(),
    revision: integer("revision").default(1).notNull(),
    settings: jsonb("settings_json")
      .$type<{ sourceTracking: boolean; mockFailOnce: boolean }>()
      .notNull(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    lastErrorMessage: text("last_error_message"),
    ...dates(),
  },
  (t) => [
    unique("provider_store_key_unique").on(t.storeId, t.providerKey),
    unique("provider_id_org_unique").on(t.id, t.organizationId),
    unique("provider_identity_unique").on(t.id, t.storeId, t.organizationId),
    foreignKey({
      name: "provider_store_tenant_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }),
    check(
      "provider_connection_values",
      sql`${t.providerKey} = 'shipcod' AND ${t.adapterMode} IN ('mock','production') AND ${t.status} IN ('not_connected','connected','error','disconnected')`,
    ),
  ],
);
export const providerConnectionMarkets = pgTable(
  "provider_connection_markets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    storeMarketId: uuid("store_market_id").notNull(),
  },
  (t) => [
    unique("provider_market_unique").on(t.connectionId, t.storeMarketId),
    foreignKey({
      name: "provider_market_connection_fk",
      columns: [t.connectionId, t.storeId, t.organizationId],
      foreignColumns: [
        providerConnections.id,
        providerConnections.storeId,
        providerConnections.organizationId,
      ],
    }),
    foreignKey({
      name: "provider_market_store_fk",
      columns: [t.storeMarketId, t.storeId, t.organizationId],
      foreignColumns: [
        storeMarkets.id,
        storeMarkets.storeId,
        storeMarkets.organizationId,
      ],
    }),
  ],
);
export const providerProductMappings = pgTable(
  "provider_product_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    productId: uuid("product_id").notNull(),
    variantId: uuid("variant_id"),
    mappingKey: text("mapping_key").notNull(),
    providerProductId: text("provider_product_id"),
    providerSku: text("provider_sku"),
    ...dates(),
  },
  (t) => [
    unique("provider_mapping_unique").on(t.connectionId, t.mappingKey),
    foreignKey({
      name: "mapping_connection_store_fk",
      columns: [t.connectionId, t.storeId, t.organizationId],
      foreignColumns: [
        providerConnections.id,
        providerConnections.storeId,
        providerConnections.organizationId,
      ],
    }),
    foreignKey({
      name: "mapping_product_store_fk",
      columns: [t.productId, t.storeId, t.organizationId],
      foreignColumns: [products.id, products.storeId, products.organizationId],
    }),
    foreignKey({
      name: "mapping_variant_product_fk",
      columns: [t.variantId, t.productId, t.organizationId],
      foreignColumns: [
        productVariants.id,
        productVariants.productId,
        productVariants.organizationId,
      ],
    }),
    check(
      "mapping_key_valid",
      sql`${t.mappingKey} = ${t.productId}::text || ':' || coalesce(${t.variantId}::text,'base') AND (${t.providerProductId} IS NOT NULL OR ${t.providerSku} IS NOT NULL)`,
    ),
  ],
);
export const providerJobs = pgTable(
  "provider_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    connectionRevision: integer("connection_revision").notNull(),
    orderId: uuid("order_id"),
    fulfillmentId: uuid("fulfillment_id"),
    shipmentId: uuid("shipment_id"),
    operation: text("operation").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    status: text("status").default("pending").notNull(),
    snapshot:
      jsonb("snapshot").$type<
        import("@africacod/validation").ProviderHandoffSnapshot
      >(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    lastError: text("last_error"),
    ...dates(),
  },
  (t) => [
    unique("provider_job_identity_unique").on(
      t.id,
      t.connectionId,
      t.organizationId,
    ),
    foreignKey({
      name: "job_connection_tenant_fk",
      columns: [t.connectionId, t.organizationId],
      foreignColumns: [
        providerConnections.id,
        providerConnections.organizationId,
      ],
    }),
    foreignKey({
      name: "job_order_tenant_fk",
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
    foreignKey({
      name: "job_fulfillment_identity_fk",
      columns: [t.fulfillmentId, t.orderId, t.organizationId],
      foreignColumns: [
        fulfillments.id,
        fulfillments.orderId,
        fulfillments.organizationId,
      ],
    }),
    foreignKey({
      name: "job_shipment_tenant_fk",
      columns: [t.shipmentId, t.organizationId],
      foreignColumns: [shipments.id, shipments.organizationId],
    }),
    index("provider_job_due_idx").on(t.status, t.availableAt),
    check(
      "provider_job_values",
      sql`${t.operation} IN ('validate','create','poll') AND ${t.status} IN ('pending','processing','done','failed','investigation','cancelled')`,
    ),
  ],
);
export const providerAttempts = pgTable(
  "provider_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => providerJobs.id),
    operation: text("operation").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    success: boolean("success"),
    safeError: text("safe_error"),
    responseIdentifier: text("response_identifier"),
  },
  (t) => [
    foreignKey({
      name: "attempt_job_tenant_fk",
      columns: [t.jobId, t.connectionId, t.organizationId],
      foreignColumns: [
        providerJobs.id,
        providerJobs.connectionId,
        providerJobs.organizationId,
      ],
    }),
    index("provider_attempt_job_idx").on(t.jobId),
    foreignKey({
      name: "attempt_provider_connection_fk",
      columns: [t.connectionId, t.organizationId],
      foreignColumns: [
        providerConnections.id,
        providerConnections.organizationId,
      ],
    }),
  ],
);
export const providerStatusEvents = pgTable(
  "provider_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    shipmentId: uuid("shipment_id").notNull(),
    eventKey: text("event_key").notNull(),
    rawStatus: text("raw_status").notNull(),
    normalizedStatus: shipmentStatus("normalized_status"),
    disposition: text("disposition").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("provider_event_dedupe").on(t.connectionId, t.eventKey),
    foreignKey({
      name: "raw_event_connection_tenant_fk",
      columns: [t.connectionId, t.organizationId],
      foreignColumns: [
        providerConnections.id,
        providerConnections.organizationId,
      ],
    }),
    foreignKey({
      name: "raw_event_shipment_tenant_fk",
      columns: [t.shipmentId, t.organizationId],
      foreignColumns: [shipments.id, shipments.organizationId],
    }),
  ],
);
// Local deterministic remote simulator only; no production provider/customer payloads are stored here.
export const providerTestShipments = pgTable("provider_test_shipments", {
  requestKey: uuid("request_key").primaryKey(),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => providerConnections.id),
  externalId: text("external_id").notNull().unique(),
  rawStatus: text("raw_status").notNull(),
  revision: integer("revision").default(1).notNull(),
  calls: integer("calls").default(0).notNull(),
  ...dates(),
});

// Tracking is explicitly enabled per Store; browser projections never include ciphertext.
export const trackingConnections = pgTable(
  "tracking_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    provider: text("provider").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    mode: text("mode").notNull(),
    settings: jsonb("settings").$type<Record<string, string>>().notNull(),
    secretEncrypted: text("secret_encrypted"),
    revision: integer("revision").default(1).notNull(),
    enabledAt: timestamp("enabled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSuccess: timestamp("last_success", { withTimezone: true }),
    lastFailure: timestamp("last_failure", { withTimezone: true }),
    lastError: text("last_error"),
    ...dates(),
  },
  (t) => [
    unique("tracking_store_provider_unique").on(t.storeId, t.provider),
    unique("tracking_identity_unique").on(t.id, t.storeId, t.organizationId),
    foreignKey({
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }),
    check(
      "tracking_provider_valid",
      sql`${t.provider} IN ('meta','tiktok','google-ads','google-sheets') AND ${t.mode} IN ('mock','browser','blocked','production')`,
    ),
  ],
);
export const commerceEvents = pgTable(
  "commerce_events",
  {
    id: text("id").primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    orderId: uuid("order_id"),
    type: text("type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("commerce_event_identity").on(t.id, t.storeId, t.organizationId),
    index("commerce_event_store_time_idx").on(t.storeId, t.occurredAt),
    index("commerce_view_retention_idx")
      .on(t.occurredAt)
      .where(sql`${t.type} = 'product_viewed'`),
    foreignKey({
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }).onDelete("cascade"),
    check(
      "commerce_event_type",
      sql`${t.type} IN ('product_viewed','checkout_submitted','order_created','order_confirmed','shipment_created','shipment_shipped','shipment_out_for_delivery','shipment_delivered','shipment_refused','shipment_returned','shipment_changed')`,
    ),
  ],
);
export const trackingJobs = pgTable(
  "tracking_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    eventId: text("event_id").notNull(),
    revision: integer("revision").notNull(),
    status: text("status").default("pending").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    safeError: text("safe_error"),
  },
  (t) => [
    unique("tracking_job_dedupe").on(t.connectionId, t.eventId),
    foreignKey({
      columns: [t.connectionId, t.storeId, t.organizationId],
      foreignColumns: [
        trackingConnections.id,
        trackingConnections.storeId,
        trackingConnections.organizationId,
      ],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.eventId, t.storeId, t.organizationId],
      foreignColumns: [
        commerceEvents.id,
        commerceEvents.storeId,
        commerceEvents.organizationId,
      ],
    }).onDelete("cascade"),
    check(
      "tracking_job_status",
      sql`${t.status} IN ('pending','processing','done','failed','skipped')`,
    ),
    index("tracking_job_due").on(t.status, t.availableAt),
    index("tracking_job_connection_idx").on(t.connectionId),
  ],
);
export const trackingAttempts = pgTable("tracking_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => trackingJobs.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  success: boolean("success"),
  safeError: text("safe_error"),
});
// Deterministic adapter receipts only. Never used as a production delivery claim.
export const trackingTestReceipts = pgTable(
  "tracking_test_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => trackingConnections.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    eventName: text("event_name").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique("tracking_receipt_dedupe").on(t.connectionId, t.eventId)],
);
export const sheetsTestRows = pgTable(
  "sheets_test_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => trackingConnections.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(),
    columns: jsonb("columns")
      .$type<Record<string, string | number>>()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique("sheets_row_mapping").on(t.connectionId, t.orderNumber)],
);

// Anonymous first-party observations, separate from immutable commerce truth.
export const visitorEvents = pgTable(
  "visitor_events",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    productId: uuid("product_id"),
    marketToken: varchar("market_token", { length: 120 }),
    type: varchar("type", { length: 30 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: "visitor_store_tenant_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "visitor_product_store_tenant_fk",
      columns: [t.productId, t.storeId, t.organizationId],
      foreignColumns: [products.id, products.storeId, products.organizationId],
    }).onDelete("cascade"),
    check(
      "visitor_type_valid",
      sql`${t.type} IN ('store_view','product_view','checkout_started')`,
    ),
    check(
      "visitor_product_required",
      sql`${t.type} = 'store_view' OR ${t.productId} IS NOT NULL`,
    ),
    index("visitor_retention_idx").on(t.occurredAt),
    index("visitor_store_time_idx").on(
      t.organizationId,
      t.storeId,
      t.occurredAt,
    ),
  ],
);

// Shared fixed-window abuse counters contain keyed hashes, never raw client IPs.
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("rate_limit_expiry_idx").on(t.expiresAt),
    check("rate_limit_positive", sql`${t.count} > 0`),
  ],
);
export const oauthStates = pgTable(
  "oauth_states",
  {
    stateHash: text("state_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    verifierEncrypted: text("verifier_encrypted").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "oauth_store_tenant_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }),
    index("oauth_expiry_idx").on(t.expiresAt),
  ],
);

export const storeAssets = pgTable(
  "store_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes"),
    ...dates(),
  },
  (t) => [
    foreignKey({
      name: "store_asset_tenant_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }),
    index("store_assets_store_org_idx").on(t.storeId, t.organizationId),
    check(
      "store_asset_valid",
      sql`(${t.bytes} IS NULL OR ${t.bytes} BETWEEN 1 AND 10485760) AND ${t.mimeType} IN ('image/png','image/jpeg','image/webp')`,
    ),
  ],
);
