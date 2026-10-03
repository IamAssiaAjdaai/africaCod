import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import {
  createDatabase,
  user,
  organizations,
  memberships,
  stores,
  oauthStates,
  trackingConnections,
  rateLimitBuckets,
} from "@africacod/db";
import { GoogleSheetsService } from "./tracking/oauth";
import { AbuseService, abuseKey } from "./abuse";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use isolated test DB");
const { db, client } = createDatabase(url);
const a = crypto.randomUUID(),
  b = crypto.randomUUID(),
  bucket = abuseKey("synthetic-secret", "checkout", a);
const key = Buffer.alloc(32, 7).toString("base64");
let orgA: string, orgB: string, storeId: string;
let calls = 0;
const service = new GoogleSheetsService(
  db,
  key,
  {
    clientId: "synthetic",
    clientSecret: "synthetic",
    redirectUri: "https://example.test/callback",
  },
  async () => {
    calls++;
    return Response.json({
      access_token: "synthetic-access",
      refresh_token: "synthetic-refresh",
      expires_in: 3600,
    });
  },
);
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../../db/drizzle", import.meta.url),
    ),
  });
  await db.insert(user).values(
    [a, b].map((id) => ({
      id,
      name: "Hardening fixture",
      email: `${id}@example.test`,
    })),
  );
  orgA = (await service.createOrganization(a, { name: "Hardening A" })).id;
  orgB = (await service.createOrganization(b, { name: "Hardening B" })).id;
  storeId = (
    await service.createStore(a, {
      name: "Hardening Store",
      slug: `hardening-${a}`,
    })
  ).id;
});
afterAll(async () => {
  await db.delete(rateLimitBuckets).where(eq(rateLimitBuckets.key, bucket));
  for (const org of [orgA, orgB].filter(Boolean)) {
    await db.delete(oauthStates).where(eq(oauthStates.organizationId, org));
    await db
      .delete(trackingConnections)
      .where(eq(trackingConnections.organizationId, org));
    await db.delete(stores).where(eq(stores.organizationId, org));
    await db.delete(memberships).where(eq(memberships.organizationId, org));
    await db.delete(organizations).where(eq(organizations.id, org));
  }
  for (const id of [a, b]) await db.delete(user).where(eq(user.id, id));
  await client.end();
});
describe("Production hardening boundaries", () => {
  it("shares an atomic abuse budget across concurrent instances and resets expired buckets", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        new AbuseService(db).consume(bucket, 7, 60),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(7);
    const [saved] = await db
      .select()
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.key, bucket));
    expect(saved.count).toBe(8);
    expect(saved.key).not.toContain(a);
    await db
      .update(rateLimitBuckets)
      .set({ expiresAt: new Date(0) })
      .where(eq(rateLimitBuckets.key, bucket));
    expect(await new AbuseService(db).consume(bucket, 7, 60)).toBe(true);
  });
  it("binds OAuth to user, tenant and cookie; consumes state once and encrypts offline tokens", async () => {
    await expect(service.begin(b, storeId)).rejects.toThrow();
    const pending = await service.begin(a, storeId);
    expect(new URL(pending.url).searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    await expect(
      service.finish(a, pending.state, "wrong", "code"),
    ).rejects.toThrow();
    await expect(
      service.finish(b, pending.state, pending.state, "code"),
    ).rejects.toThrow();
    expect(calls).toBe(0);
    expect(await service.finish(a, pending.state, pending.state, "code")).toBe(
      storeId,
    );
    await expect(
      service.finish(a, pending.state, pending.state, "code"),
    ).rejects.toThrow();
    const [connection] = await db
      .select()
      .from(trackingConnections)
      .where(eq(trackingConnections.storeId, storeId));
    expect(connection.secretEncrypted).not.toContain("synthetic-access");
    expect(connection.secretEncrypted).not.toContain("synthetic-refresh");
    expect(connection.enabled).toBe(false);
    await expect(service.disconnect(b, storeId)).rejects.toThrow();
    await service.disconnect(a, storeId);
    const [disconnected] = await db
      .select()
      .from(trackingConnections)
      .where(eq(trackingConnections.storeId, storeId));
    expect(disconnected.secretEncrypted).toBeNull();
    expect(disconnected.enabled).toBe(false);
  });
});
