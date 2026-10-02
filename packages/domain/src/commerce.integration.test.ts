import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, and, count } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import {
  createDatabase,
  user,
  countryDefinitions,
  memberships,
  organizations,
  stores,
  storeMarkets,
} from "@africacod/db";
import { countryCatalog } from "@africacod/markets";
import "@africacod/shared";
import { CommerceService } from "./index";
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL must point to an isolated database with a name ending in _test.",
  );
const { db, client } = createDatabase(testUrl);
const service = new CommerceService(db);
const a = crypto.randomUUID();
const b = crypto.randomUUID();
const newcomer = crypto.randomUUID();
let orgA: Awaited<ReturnType<typeof service.createOrganization>>;
let orgB: Awaited<ReturnType<typeof service.createOrganization>>;
let storeA: Awaited<ReturnType<typeof service.createStore>>;
let storeB: Awaited<ReturnType<typeof service.createStore>>;
let kenya: Awaited<ReturnType<typeof service.addMarket>>;
let foreignMarket: Awaited<ReturnType<typeof service.addMarket>>;
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../../db/drizzle", import.meta.url),
    ),
  });
  await db
    .insert(countryDefinitions)
    .values(countryCatalog)
    .onConflictDoNothing();
  await db.insert(user).values(
    [a, b, newcomer].map((id) => ({
      id,
      name: "Integration test",
      email: `${id}@example.com`,
    })),
  );
  orgA = await service.createOrganization(a, { name: "Organization A" });
  orgB = await service.createOrganization(b, { name: "Organization B" });
  storeA = await service.createStore(a, {
    name: "Glow Beauty",
    slug: `glow-${a}`,
  });
  storeB = await service.createStore(b, {
    name: "Private B Store",
    slug: `private-${b}`,
  });
  foreignMarket = await service.addMarket(b, {
    storeId: storeB.id,
    countryCode: "GH",
  });
});
afterAll(async () => {
  // Only remove records created by this suite; do not truncate shared test data.
  for (const id of [orgA?.id, orgB?.id].filter((id): id is string => !!id)) {
    await db.delete(storeMarkets).where(eq(storeMarkets.organizationId, id));
    await db.delete(stores).where(eq(stores.organizationId, id));
    await db.delete(memberships).where(eq(memberships.organizationId, id));
    await db.delete(organizations).where(eq(organizations.id, id));
  }
  await db.delete(user).where(eq(user.id, a));
  await db.delete(user).where(eq(user.id, b));
  await db.delete(user).where(eq(user.id, newcomer));
  await client.end();
});
describe.sequential(
  "Account → Organization → Store → Markets against PostgreSQL",
  () => {
    it("blocks unauthenticated calls", async () => {
      await expect(service.listStores(null)).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
      });
      await expect(
        service.createOrganization(null, { name: "Forged" }),
      ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
      await expect(
        service.addMarket(null, { storeId: storeA.id, countryCode: "KE" }),
      ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    });
    it("requires onboarding before creating stores", async () => {
      await expect(
        service.createStore(newcomer, {
          name: "Test Store",
          slug: `new-${newcomer}`,
        }),
      ).rejects.toMatchObject({ code: "ONBOARDING_REQUIRED" });
    });
    it("atomically creates an organization and owner membership", async () => {
      expect(await service.organizationFor(a)).toMatchObject({
        id: orgA.id,
        role: "owner",
        name: "Organization A",
      });
    });
    it("rolls back duplicate organization creation", async () => {
      const [before] = await db.select({ n: count() }).from(organizations);
      await expect(
        service.createOrganization(a, { name: "Duplicate" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const [after] = await db.select({ n: count() }).from(organizations);
      expect(after.n).toBe(before.n);
    });
    it("creates an organization-scoped store with zero markets", async () => {
      expect(storeA.organizationId).toBe(orgA.id);
      expect(storeA.status).toBe("active");
      expect(await service.listMarkets(a, storeA.id)).toEqual([]);
    });
    it("enforces globally unique public store addresses", async () => {
      await expect(
        service.createStore(b, { name: "Collision", slug: storeA.slug }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("adds Kenya with currency and locale from the country definition", async () => {
      kenya = await service.addMarket(a, {
        storeId: storeA.id,
        countryCode: "KE",
        organizationId: orgB.id,
        currency: "USD",
      });
      expect(kenya).toMatchObject({
        organizationId: orgA.id,
        countryCode: "KE",
        currency: "KES",
        locale: "en-KE",
        status: "active",
      });
      expect(await service.listMarkets(a, storeA.id)).toHaveLength(1);
    });
    it("rejects adding Kenya twice", async () => {
      await expect(
        service.addMarket(a, { storeId: storeA.id, countryCode: "KE" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await service.listMarkets(a, storeA.id)).toHaveLength(1);
    });
    it("adds Ghana separately", async () => {
      const ghana = await service.addMarket(a, {
        storeId: storeA.id,
        countryCode: "GH",
      });
      expect(ghana.currency).toBe("GHS");
      expect(await service.listMarkets(a, storeA.id)).toHaveLength(2);
    });
    it("deactivates Kenya without deleting it, then reactivates the same record", async () => {
      await service.setMarketStatus(a, {
        storeId: storeA.id,
        marketId: kenya.id,
        status: "inactive",
      });
      expect(
        (await service.listMarkets(a, storeA.id)).find((m) => m.id === kenya.id)
          ?.status,
      ).toBe("inactive");
      await expect(
        service.addMarket(a, { storeId: storeA.id, countryCode: "KE" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await service.setMarketStatus(a, {
            storeId: storeA.id,
            marketId: kenya.id,
            status: "active",
          })
        ).id,
      ).toBe(kenya.id);
    });
    it("hides Organization B stores and markets from A", async () => {
      expect((await service.listStores(a)).map((s) => s.id)).toEqual([
        storeA.id,
      ]);
      await expect(service.getStore(a, storeB.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(service.listMarkets(a, storeB.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        service.addMarket(a, { storeId: storeB.id, countryCode: "KE" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("rejects a foreign market ID even when paired with A's own store ID", async () => {
      await expect(
        service.setMarketStatus(a, {
          storeId: storeA.id,
          marketId: foreignMarket.id,
          status: "inactive",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        service.setMarketStatus(a, {
          storeId: storeB.id,
          marketId: foreignMarket.id,
          status: "inactive",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const [persisted] = await db
        .select()
        .from(storeMarkets)
        .where(
          and(
            eq(storeMarkets.id, foreignMarket.id),
            eq(storeMarkets.organizationId, orgB.id),
          ),
        );
      expect(persisted.status).toBe("active");
    });
    it("enforces tenant consistency at the database level", async () => {
      await expect(
        db.insert(storeMarkets).values({
          organizationId: orgA.id,
          storeId: storeB.id,
          countryCode: "KE",
          currency: "KES",
          locale: "en-KE",
        }),
      ).rejects.toThrow();
    });
    it("supports Admin membership without trusting a browser role", async () => {
      await db
        .update(memberships)
        .set({ role: "admin" })
        .where(eq(memberships.userId, a));
      expect((await service.listStores(a))[0].id).toBe(storeA.id);
    });
    it("does not offer inactive or unsupported platform countries", async () => {
      await expect(
        service.addMarket(a, { storeId: storeA.id, countryCode: "ZZ" }),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_COUNTRY" });
      await db
        .insert(countryDefinitions)
        .values({
          code: "ZA",
          name: "South Africa",
          currencyCode: "ZAR",
          currencySymbol: "R",
          defaultLocale: "en-ZA",
          callingCode: "+27",
          active: false,
        })
        .onConflictDoNothing();
      expect(
        (await service.supportedCountries(a)).some((c) => c.code === "ZA"),
      ).toBe(false);
      await expect(
        service.addMarket(a, { storeId: storeA.id, countryCode: "ZA" }),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_COUNTRY" });
    });
  },
);
