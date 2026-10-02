import { sql } from "drizzle-orm";
import {
  boolean,
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
    unique("market_store_country_unique").on(t.storeId, t.countryCode),
    unique("market_store_custom_unique").on(t.storeId, t.customKey),
    check(
      "market_identity_check",
      sql`(${t.countryCode} IS NOT NULL AND ${t.customKey} IS NULL) OR (${t.countryCode} IS NULL AND ${t.customKey} IS NOT NULL AND length(${t.customKey}) > 0)`,
    ),
    index("markets_org_store_idx").on(t.organizationId, t.storeId),
  ],
);
