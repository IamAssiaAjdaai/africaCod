import { eq, sql } from "drizzle-orm";
import type { Database } from "@africacod/db";
import { providerTestShipments } from "@africacod/db";
import {
  ProviderFailure,
  type ProviderResult,
  type MockRemoteStore,
} from "./providers/contract";
export class DatabaseMockRemote implements MockRemoteStore {
  constructor(
    private db: Database,
    private connectionId: string,
  ) {}
  private result(
    row: typeof providerTestShipments.$inferSelect,
  ): ProviderResult {
    return {
      externalId: row.externalId,
      eventId: `${row.externalId}:${row.revision}`,
      rawStatus: row.rawStatus,
      occurredAt: row.updatedAt,
      trackingNumber: `TEST-${row.requestKey.slice(0, 8)}`,
    };
  }
  async create(key: string, failOnce: boolean) {
    const row = await this.db.transaction(async (tx) => {
      await tx
        .insert(providerTestShipments)
        .values({
          requestKey: key,
          connectionId: this.connectionId,
          externalId: `test-shipcod-${key}`,
          rawStatus: "mock_created",
        })
        .onConflictDoNothing();
      const [current] = await tx
        .select()
        .from(providerTestShipments)
        .where(eq(providerTestShipments.requestKey, key))
        .for("update");
      if (current.connectionId !== this.connectionId)
        throw new ProviderFailure("AMBIGUOUS", false, true);
      const [updated] = await tx
        .update(providerTestShipments)
        .set({ calls: sql`${providerTestShipments.calls}+1` })
        .where(eq(providerTestShipments.requestKey, key))
        .returning();
      return updated;
    });
    if (failOnce && row.calls === 1)
      throw new ProviderFailure("UNAVAILABLE", true);
    return this.result(row);
  }
  async get(id: string) {
    const [row] = await this.db
      .select()
      .from(providerTestShipments)
      .where(eq(providerTestShipments.externalId, id));
    if (!row || row.connectionId !== this.connectionId)
      throw new ProviderFailure("UNAVAILABLE", true);
    return this.result(row);
  }
}
