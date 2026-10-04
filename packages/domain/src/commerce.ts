import { isCatalogCountry, normalizeMarketName } from "@africacod/markets";
import { and, asc, eq } from "drizzle-orm";
import {
  type Database,
  ensureInitialWorkspace,
  countryDefinitions,
  memberships,
  organizations,
  stores,
  storeMarkets,
} from "@africacod/db";
import {
  organizationInput,
  storeInput,
  marketInput,
  marketStatusInput,
  customMarketInput,
} from "@africacod/validation";
export class DomainError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "ONBOARDING_REQUIRED"
      | "NOT_FOUND"
      | "CONFLICT"
      | "COUNTRY_NOT_FOUND"
      | "CANONICAL_COUNTRY_REQUIRED"
      | "INVALID_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
export function requireUser(userId: string | null | undefined): string {
  if (!userId)
    throw new DomainError("UNAUTHENTICATED", "Please sign in to continue.");
  return userId;
}
function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}
export class CommerceService {
  constructor(
    protected readonly db: Database,
    private readonly organizationResolver?: (
      userId: string,
    ) => Promise<{ id: string; name: string; role: "owner" | "admin" } | null>,
  ) {}
  async ensureInitialOrganization(userId: string | null) {
    return ensureInitialWorkspace(this.db, requireUser(userId));
  }
  async organizationFor(userId: string | null) {
    const id = requireUser(userId);
    if (this.organizationResolver) return this.organizationResolver(id);
    const [row] = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(
        organizations,
        eq(organizations.id, memberships.organizationId),
      )
      .where(eq(memberships.userId, id))
      .orderBy(asc(memberships.createdAt), asc(memberships.id))
      .limit(1);
    return row ?? null;
  }
  protected async tenant(userId: string | null) {
    const org = await this.organizationFor(userId);
    if (!org)
      throw new DomainError(
        "ONBOARDING_REQUIRED",
        "Create your organization first.",
      );
    // Roles originate only from persisted membership, never request data.
    if (org.role !== "owner" && org.role !== "admin")
      throw new DomainError("NOT_FOUND", "Organization not found.");
    return org;
  }
  async createOrganization(userId: string | null, input: unknown) {
    const id = requireUser(userId);
    const value = organizationInput.parse(input);
    return this.db.transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizations)
        .values(value)
        .returning();
      await tx.insert(memberships).values({
        organizationId: organization.id,
        userId: id,
        role: "owner",
      });
      return organization;
    });
  }

  async listStores(userId: string | null) {
    const org = await this.tenant(userId);
    return this.db
      .select()
      .from(stores)
      .where(eq(stores.organizationId, org.id))
      .orderBy(asc(stores.createdAt));
  }
  async createStore(userId: string | null, input: unknown) {
    const org = await this.tenant(userId);
    const value = storeInput.parse(input);
    try {
      const [store] = await this.db
        .insert(stores)
        .values({ ...value, organizationId: org.id })
        .returning();
      // Deliberately no StoreMarket insert. A store always starts with zero markets.
      return store;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new DomainError(
          "CONFLICT",
          "This store address is already taken. Choose another.",
        );
      throw error;
    }
  }
  async getStore(userId: string | null, storeId: string) {
    const org = await this.tenant(userId);
    const [store] = await this.db
      .select()
      .from(stores)
      .where(and(eq(stores.id, storeId), eq(stores.organizationId, org.id)))
      .limit(1);
    if (!store) throw new DomainError("NOT_FOUND", "Store not found.");
    return store;
  }
  async listMarkets(userId: string | null, storeId: string) {
    const store = await this.getStore(userId, storeId);
    return this.db
      .select({
        id: storeMarkets.id,
        organizationId: storeMarkets.organizationId,
        storeId: storeMarkets.storeId,
        countryCode: storeMarkets.countryCode,
        customKey: storeMarkets.customKey,
        checkoutConfig: storeMarkets.checkoutConfig,
        countryName: storeMarkets.name,
        callingCode: storeMarkets.callingCode,
        currency: storeMarkets.currency,
        locale: storeMarkets.locale,
        status: storeMarkets.status,
        createdAt: storeMarkets.createdAt,
      })
      .from(storeMarkets)
      .where(
        and(
          eq(storeMarkets.storeId, store.id),
          eq(storeMarkets.organizationId, store.organizationId),
        ),
      )
      .orderBy(asc(storeMarkets.name));
  }
  async listCountries(userId: string | null) {
    await this.tenant(userId);
    return this.db
      .select()
      .from(countryDefinitions)
      .orderBy(asc(countryDefinitions.name));
  }
  async listMerchantCountries(userId: string | null) {
    await this.tenant(userId);
    return this.db
      .select()
      .from(countryDefinitions)
      .where(
        and(
          eq(countryDefinitions.continent, "AF"),
          eq(countryDefinitions.merchantMarketEnabled, true),
        ),
      )
      .orderBy(asc(countryDefinitions.name));
  }
  async addMarket(userId: string | null, input: unknown) {
    const value = marketInput.parse(input);
    const store = await this.getStore(userId, value.storeId);
    const [country] = await this.db
      .select()
      .from(countryDefinitions)
      .where(eq(countryDefinitions.code, value.countryCode))
      .limit(1);
    if (!country)
      throw new DomainError(
        "COUNTRY_NOT_FOUND",
        "Choose a country from the catalog.",
      );
    try {
      const [market] = await this.db
        .insert(storeMarkets)
        .values({
          organizationId: store.organizationId,
          storeId: store.id,
          countryCode: country.code,
          name: country.name,
          callingCode: country.callingCode,
          currency: country.currencyCode,
          locale: country.defaultLocale,
        })
        .returning();
      return market;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new DomainError(
          "CONFLICT",
          "This market already exists. You can reactivate it from the list.",
        );
      throw error;
    }
  }
  // Reserved service boundary; custom-market creation UI is intentionally deferred.
  async addCustomMarket(userId: string | null, input: unknown) {
    const value = customMarketInput.parse(input);
    const store = await this.getStore(userId, value.storeId);
    const definitions = await this.listCountries(userId);
    const customKey = normalizeMarketName(value.name);
    if (!customKey)
      throw new DomainError("CONFLICT", "Use a meaningful market name.");
    if (
      isCatalogCountry(value.name) ||
      definitions.some(
        (country) =>
          normalizeMarketName(country.name) === customKey ||
          normalizeMarketName(country.code) === customKey,
      )
    )
      throw new DomainError(
        "CANONICAL_COUNTRY_REQUIRED",
        "Choose the canonical country from the catalog.",
      );
    try {
      const [market] = await this.db
        .insert(storeMarkets)
        .values({
          organizationId: store.organizationId,
          storeId: store.id,
          countryCode: null,
          customKey,
          name: value.name,
          currency: value.currency,
          locale: Intl.getCanonicalLocales(value.locale)[0],
          callingCode: value.callingCode,
        })
        .returning();
      return market;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new DomainError("CONFLICT", "This custom market already exists.");
      throw error;
    }
  }
  async setMarketStatus(userId: string | null, input: unknown) {
    const value = marketStatusInput.parse(input);
    const store = await this.getStore(userId, value.storeId);
    const [market] = await this.db
      .update(storeMarkets)
      .set({ status: value.status, updatedAt: new Date() })
      .where(
        and(
          eq(storeMarkets.id, value.marketId),
          eq(storeMarkets.storeId, store.id),
          eq(storeMarkets.organizationId, store.organizationId),
        ),
      )
      .returning();
    if (!market) throw new DomainError("NOT_FOUND", "Market not found.");
    return market;
  }
}
