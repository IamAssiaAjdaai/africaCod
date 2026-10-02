import { and, eq, asc, desc, inArray, sql, lte, or } from "drizzle-orm";
import { z } from "zod";
import {
  type Database,
  providerConnections,
  providerConnectionMarkets,
  providerProductMappings,
  providerJobs,
  providerAttempts,
  providerStatusEvents,
  providerTestShipments,
  orders,
  orderItems,
  orderAttribution,
  fulfillments,
  fulfillmentStateEvents,
  shipments,
  shipmentEvents,
  storeMarkets,
} from "@africacod/db";
import { OperationsService } from "../operations";
import { DomainError } from "../commerce";
import { CredentialVault } from "./credentials";
import { providerRegistry } from "./providers/shipcod";
import { DatabaseMockRemote } from "./mock-remote";
import {
  ProviderFailure,
  type HandoffSnapshot,
  type ProviderResult,
} from "./providers/contract";
import { shipmentTransitions } from "../lifecycle";
export type ProviderRuntime = {
  testMode: boolean;
  encryptionKey: string | undefined;
};
const safeConnection = {
  id: providerConnections.id,
  storeId: providerConnections.storeId,
  providerKey: providerConnections.providerKey,
  adapterMode: providerConnections.adapterMode,
  status: providerConnections.status,
  settings: providerConnections.settings,
  lastSuccessAt: providerConnections.lastSuccessAt,
  lastErrorAt: providerConnections.lastErrorAt,
  lastErrorMessage: providerConnections.lastErrorMessage,
};
const safeErrors = {
  INVALID_CREDENTIALS: "Provider credentials were rejected.",
  UNAVAILABLE:
    "The provider is temporarily unavailable. Retry or use manual fulfillment.",
  PRODUCTION_BLOCKED:
    "Production ShipCOD is blocked pending official API documentation.",
  AMBIGUOUS:
    "The provider result is uncertain. Investigate before retrying or creating a manual shipment.",
  CONFIGURATION_CHANGED: "Connection configuration changed. Review and retry.",
  UNKNOWN_STATUS: "Unknown provider status requires investigation.",
  INVALID_TRANSITION:
    "Provider status would violate the internal shipment state machine.",
};
export class ProviderService extends OperationsService {
  constructor(
    db: Database,
    private runtime: ProviderRuntime,
  ) {
    super(db);
  }
  private adapter(connectionId: string, failOnce = false) {
    return providerRegistry(
      this.runtime.testMode,
      new DatabaseMockRemote(this.db, connectionId),
      failOnce,
    ).get("shipcod")!;
  }
  private vault() {
    return new CredentialVault(this.runtime.encryptionKey);
  }
  private context(c: { id: string; organizationId: string; storeId: string }) {
    return `${c.organizationId}:${c.storeId}:${c.id}:shipcod`;
  }
  async connection(userId: string | null, id: string) {
    const org = await this.tenant(userId);
    const [row] = await this.db
      .select(safeConnection)
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.id, z.uuid().parse(id)),
          eq(providerConnections.organizationId, org.id),
        ),
      );
    if (!row)
      throw new DomainError("NOT_FOUND", "Provider connection not found.");
    return row;
  }
  async connectionForStore(userId: string | null, storeId: string) {
    await this.getStore(userId, storeId);
    const [row] = await this.db
      .select(safeConnection)
      .from(providerConnections)
      .where(eq(providerConnections.storeId, storeId));
    return row ?? null;
  }
  async configure(userId: string | null, storeId: string, input: unknown) {
    const store = await this.getStore(userId, storeId);
    if (!this.runtime.testMode)
      throw new DomainError("INVALID_INPUT", safeErrors.PRODUCTION_BLOCKED);
    const value = z
      .object({
        apiKey: z.string().trim().min(1).max(500).optional(),
        apiSecret: z.string().trim().min(1).max(500).optional(),
        marketIds: z.array(z.uuid()).max(100),
        sourceTracking: z.boolean().default(false),
        mockFailOnce: z.boolean().default(false),
      })
      .parse(input);
    const markets = await this.listMarkets(userId, storeId);
    if (
      value.marketIds.some(
        (id) =>
          !markets.some(
            (m) =>
              m.id === id &&
              m.status === "active" &&
              m.countryCode &&
              this.adapter(storeId)
                .getSupportedMarkets()
                .includes(m.countryCode),
          ),
      )
    )
      throw new DomainError(
        "INVALID_INPUT",
        "Select active StoreMarkets supported by this provider.",
      );
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${storeId},0))`,
      );
      const [old] = await tx
        .select()
        .from(providerConnections)
        .where(eq(providerConnections.storeId, storeId))
        .for("update");
      const id = old?.id ?? crypto.randomUUID();
      const credentials =
        value.apiKey && value.apiSecret
          ? this.vault().encrypt(
              { apiKey: value.apiKey, apiSecret: value.apiSecret },
              this.context({
                id,
                organizationId: store.organizationId,
                storeId,
              }),
            )
          : old?.credentialsEncrypted;
      if (!credentials || Boolean(value.apiKey) !== Boolean(value.apiSecret))
        throw new DomainError(
          "INVALID_INPUT",
          "Supply both API key and secret. Leave both blank to retain saved credentials.",
        );
      const values = {
        credentialsEncrypted: credentials,
        status: "not_connected",
        revision: (old?.revision ?? 0) + 1,
        settings: {
          sourceTracking: value.sourceTracking,
          mockFailOnce: value.mockFailOnce,
        },
        lastErrorMessage: null,
        updatedAt: new Date(),
      };
      if (old)
        await tx
          .update(providerConnections)
          .set(values)
          .where(eq(providerConnections.id, id));
      else
        await tx.insert(providerConnections).values({
          id,
          organizationId: store.organizationId,
          storeId,
          providerKey: "shipcod",
          adapterMode: "mock",
          ...values,
        });
      await tx
        .delete(providerConnectionMarkets)
        .where(eq(providerConnectionMarkets.connectionId, id));
      if (value.marketIds.length)
        await tx.insert(providerConnectionMarkets).values(
          [...new Set(value.marketIds)].map((storeMarketId) => ({
            organizationId: store.organizationId,
            storeId,
            connectionId: id,
            storeMarketId,
          })),
        );
      return id;
    });
  }
  async enabledMarkets(userId: string | null, id: string) {
    await this.connection(userId, id);
    return this.db
      .select({ id: providerConnectionMarkets.storeMarketId })
      .from(providerConnectionMarkets)
      .where(eq(providerConnectionMarkets.connectionId, id));
  }
  async mappings(userId: string | null, id: string) {
    await this.connection(userId, id);
    return this.db
      .select()
      .from(providerProductMappings)
      .where(eq(providerProductMappings.connectionId, id));
  }
  async saveMapping(userId: string | null, id: string, input: unknown) {
    const c = await this.connection(userId, id);
    const value = z
      .object({
        productId: z.uuid(),
        variantId: z.uuid().nullable().default(null),
        providerProductId: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .nullable()
          .default(null),
        providerSku: z.string().trim().min(1).max(120).nullable().default(null),
      })
      .refine(
        (v) => v.providerProductId || v.providerSku,
        "Supply a provider product ID or SKU.",
      )
      .parse(input);
    const p = await this.getProduct(userId, value.productId);
    if (p.storeId !== c.storeId)
      throw new DomainError(
        "NOT_FOUND",
        "Product is not in this connection's store.",
      );
    if (value.variantId) {
      const variants = await this.listVariants(userId, p.id);
      if (!variants.some((v) => v.id === value.variantId))
        throw new DomainError("NOT_FOUND", "Variant not found.");
    }
    await this.db
      .insert(providerProductMappings)
      .values({
        ...value,
        organizationId: p.organizationId,
        storeId: c.storeId,
        connectionId: id,
        mappingKey: `${p.id}:${value.variantId ?? "base"}`,
      })
      .onConflictDoUpdate({
        target: [
          providerProductMappings.connectionId,
          providerProductMappings.mappingKey,
        ],
        set: {
          providerProductId: value.providerProductId,
          providerSku: value.providerSku,
          updatedAt: new Date(),
        },
      });
  }
  async disconnect(userId: string | null, id: string) {
    await this.connection(userId, id);
    await this.db
      .update(providerConnections)
      .set({
        status: "disconnected",
        revision: sql`${providerConnections.revision}+1`,
        updatedAt: new Date(),
      })
      .where(eq(providerConnections.id, id));
  }
  async testConnection(userId: string | null, id: string) {
    await this.connection(userId, id);
    const [c] = await this.db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, id));
    return this.queueJob({
      organizationId: c.organizationId,
      connectionId: id,
      connectionRevision: c.revision,
      operation: "validate",
      dedupeKey: `validate:${id}:${c.revision}`,
    });
  }
  private async queueJob(value: typeof providerJobs.$inferInsert) {
    return this.db.transaction(async (tx) => {
      await tx.insert(providerJobs).values(value).onConflictDoNothing();
      const [job] = await tx
        .select()
        .from(providerJobs)
        .where(eq(providerJobs.dedupeKey, value.dedupeKey))
        .for("update");
      if (job.status === "processing") return job;
      const [queued] = await tx
        .update(providerJobs)
        .set({
          status: "pending",
          connectionRevision: value.connectionRevision,
          availableAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(providerJobs.id, job.id))
        .returning();
      return queued;
    });
  }

  async readiness(userId: string | null, orderId: string) {
    const data = await this.getOperations(userId, orderId);
    const connection = await this.connectionForStore(
      userId,
      data.order.storeId,
    );
    const checks = {
      confirmed: data.order.status === "confirmed",
      connection:
        connection?.status === "connected" &&
        connection.adapterMode ===
          (this.runtime.testMode ? "mock" : "production"),
      market: false,
      mappings: false,
      customer: !!(
        data.order.customerName &&
        data.order.phone &&
        data.order.address &&
        data.order.city
      ),
    };
    if (connection) {
      const [enabled, activeMarkets] = await Promise.all([
        this.enabledMarkets(userId, connection.id),
        this.listMarkets(userId, data.order.storeId),
      ]);
      checks.market = !!(
        data.order.countryCode &&
        this.adapter(connection.id)
          .getSupportedMarkets()
          .includes(data.order.countryCode) &&
        enabled.some((m) => m.id === data.order.storeMarketId) &&
        activeMarkets.some(
          (m) => m.id === data.order.storeMarketId && m.status === "active",
        )
      );
      const mappings = await this.mappings(userId, connection.id);
      checks.mappings = data.items.every((i) =>
        mappings.some(
          (m) =>
            m.productId === i.productId &&
            (m.variantId === i.variantId || m.variantId === null),
        ),
      );
    }
    return { connection, checks, ready: Object.values(checks).every(Boolean) };
  }
  async requestHandoff(userId: string | null, orderId: string) {
    const readiness = await this.readiness(userId, orderId);
    if (!readiness.ready || !readiness.connection)
      throw new DomainError(
        "INVALID_INPUT",
        "ShipCOD handoff requires a confirmed order, connected provider, enabled supported market, product mappings and valid customer details.",
      );
    const c = readiness.connection;
    const org = await this.tenant(userId);
    return this.db.transaction(async (tx) => {
      const [o] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.organizationId, org.id)))
        .for("update");
      const [f] = await tx
        .select()
        .from(fulfillments)
        .where(eq(fulfillments.orderId, o.id))
        .for("update");
      if (
        o.status !== "confirmed" ||
        !f ||
        !["ready", "processing", "failed"].includes(f.status)
      )
        throw new DomainError(
          "INVALID_INPUT",
          "Create an eligible fulfillment first.",
        );
      const [existing] = await tx
        .select()
        .from(providerJobs)
        .where(eq(providerJobs.dedupeKey, `create:${f.id}`))
        .for("update");
      if (existing) {
        if (
          ["pending", "processing", "done", "investigation"].includes(
            existing.status,
          )
        )
          return existing;
        if (existing.connectionId !== c.id)
          throw new DomainError(
            "INVALID_INPUT",
            "This fulfillment belongs to another provider request.",
          );
      }
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, o.id));
      const mappings = await tx
        .select()
        .from(providerProductMappings)
        .where(eq(providerProductMappings.connectionId, c.id));
      const mapped = items.map((i) => {
        const m =
          mappings.find(
            (m) => m.productId === i.productId && m.variantId === i.variantId,
          ) ??
          mappings.find(
            (m) => m.productId === i.productId && m.variantId === null,
          );
        if (!m)
          throw new DomainError(
            "INVALID_INPUT",
            "A product mapping is missing.",
          );
        return {
          name: i.productName,
          quantity: i.quantity,
          providerProductId: m.providerProductId,
          providerSku: m.providerSku,
        };
      });
      const [fullC] = await tx
        .select()
        .from(providerConnections)
        .where(eq(providerConnections.id, c.id))
        .for("share");
      if (fullC.status !== "connected")
        throw new DomainError("INVALID_INPUT", "Provider is not connected.");
      const [enabled] = await tx
        .select()
        .from(providerConnectionMarkets)
        .where(
          and(
            eq(providerConnectionMarkets.connectionId, c.id),
            eq(providerConnectionMarkets.storeMarketId, o.storeMarketId),
          ),
        );
      const [market] = await tx
        .select()
        .from(storeMarkets)
        .where(eq(storeMarkets.id, o.storeMarketId));
      if (!enabled || market.status !== "active")
        throw new DomainError(
          "INVALID_INPUT",
          "Provider market is inactive or disabled.",
        );
      const [attribution] = c.settings.sourceTracking
        ? await tx
            .select()
            .from(orderAttribution)
            .where(eq(orderAttribution.orderId, o.id))
        : [];
      const snapshot: HandoffSnapshot = existing?.snapshot ?? {
        orderNumber: o.orderNumber,
        countryCode: o.countryCode!,
        currency: o.currency,
        totalMinor: o.totalMinor,
        customer: {
          name: o.customerName,
          phone: o.phone,
          region: o.region,
          city: o.city,
          address: o.address,
        },
        items: mapped,
        ...(attribution?.utmSource ? { source: attribution.utmSource } : {}),
      };
      await tx
        .update(fulfillments)
        .set({
          mode: "provider",
          providerConnectionId: c.id,
          status: "processing",
          updatedAt: new Date(),
        })
        .where(eq(fulfillments.id, f.id));
      await tx.insert(fulfillmentStateEvents).values({
        organizationId: org.id,
        orderId: o.id,
        fulfillmentId: f.id,
        fromStatus: f.status,
        toStatus: "processing",
        note: "ShipCOD handoff queued",
      });
      if (existing) {
        const [job] = await tx
          .update(providerJobs)
          .set({
            status: "pending",
            connectionRevision: fullC.revision,
            availableAt: new Date(),
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(providerJobs.id, existing.id))
          .returning();
        return job;
      }
      const [job] = await tx
        .insert(providerJobs)
        .values({
          organizationId: org.id,
          connectionId: c.id,
          connectionRevision: fullC.revision,
          orderId: o.id,
          fulfillmentId: f.id,
          operation: "create",
          dedupeKey: `create:${f.id}`,
          snapshot,
        })
        .returning();
      return job;
    });
  }
  async manualFallback(userId: string | null, orderId: string) {
    const org = await this.tenant(userId);
    z.uuid().parse(orderId);
    await this.db.transaction(async (tx) => {
      const [o] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.organizationId, org.id)))
        .for("update");
      if (!o) throw new DomainError("NOT_FOUND", "Order not found.");
      const [f] = await tx
        .select()
        .from(fulfillments)
        .where(eq(fulfillments.orderId, o.id))
        .for("update");
      if (!f) throw new DomainError("NOT_FOUND", "Fulfillment not found.");
      if (
        f.mode !== "provider" ||
        !["ready", "processing", "failed"].includes(f.status)
      )
        throw new DomainError(
          "INVALID_INPUT",
          "Only an unresolved provider fulfillment can use manual fallback.",
        );
      const jobs = await tx
        .select()
        .from(providerJobs)
        .where(eq(providerJobs.fulfillmentId, f.id))
        .for("update");
      if (
        jobs.some((j) =>
          ["processing", "done", "investigation"].includes(j.status),
        ) ||
        f.status === "fulfilled"
      )
        throw new DomainError(
          "INVALID_INPUT",
          "Resolve the provider request before using manual fallback.",
        );
      await tx
        .update(providerJobs)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(providerJobs.fulfillmentId, f.id));
      await tx
        .update(fulfillments)
        .set({
          mode: "manual",
          providerConnectionId: null,
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(fulfillments.id, f.id));
      await tx.insert(fulfillmentStateEvents).values({
        organizationId: org.id,
        orderId: o.id,
        fulfillmentId: f.id,
        fromStatus: f.status,
        toStatus: "ready",
        note: "Manual fallback selected",
      });
    });
  }
  async integrationDetails(userId: string | null, orderId: string) {
    const data = await this.getOperations(userId, orderId);
    const jobs = await this.db
      .select({
        id: providerJobs.id,
        operation: providerJobs.operation,
        status: providerJobs.status,
        lastError: providerJobs.lastError,
        attemptCount: providerJobs.attemptCount,
      })
      .from(providerJobs)
      .where(
        and(
          eq(providerJobs.orderId, orderId),
          eq(providerJobs.organizationId, data.order.organizationId),
        ),
      )
      .orderBy(desc(providerJobs.createdAt));
    const attempts = jobs.length
      ? await this.db
          .select({
            id: providerAttempts.id,
            operation: providerAttempts.operation,
            startedAt: providerAttempts.startedAt,
            finishedAt: providerAttempts.finishedAt,
            success: providerAttempts.success,
            safeError: providerAttempts.safeError,
            responseIdentifier: providerAttempts.responseIdentifier,
          })
          .from(providerAttempts)
          .where(
            and(
              eq(providerAttempts.organizationId, data.order.organizationId),
              inArray(
                providerAttempts.jobId,
                jobs.map((j) => j.id),
              ),
            ),
          )
          .orderBy(desc(providerAttempts.startedAt))
      : [];
    return {
      data,
      jobs,
      attempts,
      readiness: await this.readiness(userId, orderId),
    };
  }
  async requestSync(userId: string | null, shipmentId: string) {
    const org = await this.tenant(userId);
    const [s] = await this.db
      .select()
      .from(shipments)
      .where(
        and(
          eq(shipments.id, z.uuid().parse(shipmentId)),
          eq(shipments.organizationId, org.id),
        ),
      );
    if (!s?.providerConnectionId)
      throw new DomainError("NOT_FOUND", "Provider shipment not found.");
    if (["delivered", "returned", "cancelled"].includes(s.status)) return null;
    const [c] = await this.db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, s.providerConnectionId));
    return this.queueJob({
      organizationId: org.id,
      connectionId: c.id,
      connectionRevision: c.revision,
      orderId: s.orderId,
      shipmentId: s.id,
      operation: "poll",
      dedupeKey: `poll:${s.id}`,
    });
  }
  async simulateStatus(userId: string | null, shipmentId: string, raw: string) {
    if (!this.runtime.testMode)
      throw new DomainError("NOT_FOUND", "Test adapter is unavailable.");
    const org = await this.tenant(userId);
    const [s] = await this.db
      .select()
      .from(shipments)
      .where(
        and(
          eq(shipments.id, z.uuid().parse(shipmentId)),
          eq(shipments.organizationId, org.id),
        ),
      );
    if (!s?.providerConnectionId)
      throw new DomainError("NOT_FOUND", "Provider shipment not found.");
    const c = await this.connection(userId, s.providerConnectionId);
    if (c.adapterMode !== "mock")
      throw new DomainError("NOT_FOUND", "Test adapter is unavailable.");
    z.string()
      .regex(/^mock_[a-z_]{1,60}$/)
      .parse(raw);
    await this.db
      .update(providerTestShipments)
      .set({
        rawStatus: raw,
        revision: sql`${providerTestShipments.revision}+1`,
        updatedAt: new Date(),
      })
      .where(eq(providerTestShipments.externalId, s.providerShipmentId!));
    return this.requestSync(userId, s.id);
  }
  // Worker owns a session advisory lock across the external call; state and attempt start
  // are committed first. Crashes release the lock, but durable request keys survive.
  async runOne() {
    const now = new Date();
    const [candidate] = await this.db
      .select({ id: providerJobs.id })
      .from(providerJobs)
      .where(
        and(
          lte(providerJobs.availableAt, now),
          or(
            eq(providerJobs.status, "pending"),
            and(
              eq(providerJobs.status, "processing"),
              lte(providerJobs.leaseUntil, now),
            ),
          ),
        ),
      )
      .orderBy(asc(providerJobs.availableAt))
      .limit(1);
    if (!candidate) return false;
    const session = await this.db.$client.reserve();
    try {
      const [lock] =
        await session`select pg_try_advisory_lock(hashtextextended(${candidate.id},0)) as locked`;
      if (!lock.locked) return false;
      const claimed = await this.db.transaction(async (tx) => {
        const [j] = await tx
          .select()
          .from(providerJobs)
          .where(eq(providerJobs.id, candidate.id))
          .for("update");
        if (
          !["pending", "processing"].includes(j.status) ||
          j.availableAt > new Date() ||
          (j.status === "processing" &&
            j.leaseUntil &&
            j.leaseUntil > new Date())
        )
          return null;
        const [c] = await tx
          .select()
          .from(providerConnections)
          .where(eq(providerConnections.id, j.connectionId));
        if (c.organizationId !== j.organizationId)
          throw new Error("Invalid provider job relationship");
        if (j.status === "processing")
          await tx
            .update(providerAttempts)
            .set({
              finishedAt: new Date(),
              success: false,
              safeError:
                "Worker lease expired before acknowledgement; recovery uses the persisted request key.",
            })
            .where(
              and(
                eq(providerAttempts.jobId, j.id),
                sql`${providerAttempts.finishedAt} is null`,
              ),
            );
        const adapter = this.adapter(c.id, c.settings.mockFailOnce);
        if (
          j.status === "processing" &&
          !adapter.supportsIdempotency &&
          j.operation === "create"
        ) {
          await tx
            .update(providerJobs)
            .set({
              status: "investigation",
              lastError: safeErrors.AMBIGUOUS,
              leaseUntil: null,
            })
            .where(eq(providerJobs.id, j.id));
          return null;
        }
        const [updated] = await tx
          .update(providerJobs)
          .set({
            status: "processing",
            attemptCount: j.attemptCount + 1,
            leaseUntil: new Date(Date.now() + 120000),
            updatedAt: new Date(),
          })
          .where(eq(providerJobs.id, j.id))
          .returning();
        const [attempt] = await tx
          .insert(providerAttempts)
          .values({
            organizationId: j.organizationId,
            connectionId: c.id,
            jobId: j.id,
            operation: j.operation,
          })
          .returning();
        return { job: updated, connection: c, attempt };
      });
      if (!claimed) return false;
      const { job: j, connection: c, attempt } = claimed;
      try {
        if (
          c.adapterMode !== (this.runtime.testMode ? "mock" : "production") ||
          c.revision !== j.connectionRevision
        )
          throw new ProviderFailure("UNAVAILABLE");
        if (j.operation !== "validate" && c.status !== "connected")
          throw new ProviderFailure("INVALID_CREDENTIALS");
        const credentials = this.vault().decrypt(
          c.credentialsEncrypted,
          this.context(c),
        );
        const adapter = this.adapter(c.id, c.settings.mockFailOnce);
        if (j.operation === "validate") {
          if (!(await adapter.validateCredentials(credentials)))
            throw new ProviderFailure("INVALID_CREDENTIALS");
          await this.db.transaction(async (tx) => {
            await tx
              .update(providerConnections)
              .set({
                status: "connected",
                lastSuccessAt: new Date(),
                lastErrorMessage: null,
              })
              .where(
                and(
                  eq(providerConnections.id, c.id),
                  eq(providerConnections.revision, j.connectionRevision),
                ),
              );
            await tx
              .update(providerJobs)
              .set({ status: "done", leaseUntil: null, lastError: null })
              .where(eq(providerJobs.id, j.id));
            await tx
              .update(providerAttempts)
              .set({ finishedAt: new Date(), success: true })
              .where(eq(providerAttempts.id, attempt.id));
          });
        } else if (j.operation === "create") {
          if (!j.snapshot || !j.fulfillmentId || !j.orderId)
            throw new ProviderFailure("AMBIGUOUS", false, true);
          const [market] = await this.db
            .select()
            .from(storeMarkets)
            .where(
              and(
                eq(storeMarkets.storeId, c.storeId),
                eq(storeMarkets.organizationId, c.organizationId),
                eq(storeMarkets.countryCode, j.snapshot.countryCode),
                eq(storeMarkets.status, "active"),
              ),
            );
          const [enabled] = market
            ? await this.db
                .select()
                .from(providerConnectionMarkets)
                .where(
                  and(
                    eq(providerConnectionMarkets.connectionId, c.id),
                    eq(providerConnectionMarkets.storeMarketId, market.id),
                  ),
                )
            : [];
          if (!enabled) throw new ProviderFailure("UNAVAILABLE");
          const result = await adapter.createShipment(
            credentials,
            j.fulfillmentId,
            j.snapshot,
          );
          await this.finishCreation(j, c, result, attempt.id);
        } else {
          const [s] = await this.db
            .select()
            .from(shipments)
            .where(
              and(
                eq(shipments.id, j.shipmentId!),
                eq(shipments.organizationId, c.organizationId),
                eq(shipments.providerConnectionId, c.id),
              ),
            );
          if (!s?.providerShipmentId)
            throw new ProviderFailure("AMBIGUOUS", false, true);
          if (["delivered", "returned", "cancelled"].includes(s.status)) {
            await this.db
              .update(providerJobs)
              .set({ status: "done", leaseUntil: null })
              .where(eq(providerJobs.id, j.id));
            await this.db
              .update(providerAttempts)
              .set({ finishedAt: new Date(), success: true })
              .where(eq(providerAttempts.id, attempt.id));
          } else {
            const result = await adapter.getShipmentStatus(
              credentials,
              s.providerShipmentId,
            );
            await this.finishSync(j, c, s, result, attempt.id);
          }
        }
      } catch (error) {
        const failure =
          error instanceof ProviderFailure
            ? error
            : new ProviderFailure("AMBIGUOUS", false, j.operation === "create");
        const safe = safeErrors[failure.code];
        await this.db.transaction(async (tx) => {
          if (j.orderId)
            await tx
              .select()
              .from(orders)
              .where(eq(orders.id, j.orderId))
              .for("update");
          await tx
            .update(providerJobs)
            .set({
              status: failure.ambiguous ? "investigation" : "failed",
              lastError: safe,
              leaseUntil: null,
              updatedAt: new Date(),
            })
            .where(eq(providerJobs.id, j.id));
          await tx
            .update(providerAttempts)
            .set({ finishedAt: new Date(), success: false, safeError: safe })
            .where(eq(providerAttempts.id, attempt.id));
          await tx
            .update(providerConnections)
            .set({
              lastErrorAt: new Date(),
              lastErrorMessage: safe,
              ...(j.operation === "validate" ? { status: "error" } : {}),
            })
            .where(eq(providerConnections.id, c.id));
          if (j.operation === "create" && j.fulfillmentId) {
            const [f] = await tx
              .select()
              .from(fulfillments)
              .where(eq(fulfillments.id, j.fulfillmentId));
            await tx
              .update(fulfillments)
              .set({ status: "failed", updatedAt: new Date() })
              .where(eq(fulfillments.id, f.id));
            await tx.insert(fulfillmentStateEvents).values({
              organizationId: c.organizationId,
              orderId: j.orderId!,
              fulfillmentId: f.id,
              fromStatus: f.status,
              toStatus: "failed",
              note: safe,
            });
          }
          if (j.shipmentId)
            await tx
              .update(shipments)
              .set({ integrationError: safe })
              .where(eq(shipments.id, j.shipmentId));
        });
      }
      return true;
    } finally {
      await session`select pg_advisory_unlock(hashtextextended(${candidate.id},0))`;
      await session.release();
    }
  }
  private async finishCreation(
    j: typeof providerJobs.$inferSelect,
    c: typeof providerConnections.$inferSelect,
    result: ProviderResult,
    attemptId: string,
  ) {
    z.string().min(1).max(120).parse(result.externalId);
    z.string().min(1).max(180).parse(result.eventId);
    z.date().parse(result.occurredAt);
    const raw = z.string().min(1).max(120).parse(result.rawStatus);
    const mapped = this.adapter(c.id).mapProviderStatus(raw);
    const creationError =
      mapped === "created"
        ? null
        : mapped
          ? safeErrors.INVALID_TRANSITION
          : safeErrors.UNKNOWN_STATUS;
    const trackingUrl =
      result.trackingUrl && /^https?:\/\//.test(result.trackingUrl)
        ? result.trackingUrl
        : null;
    await this.db.transaction(async (tx) => {
      await tx
        .select()
        .from(orders)
        .where(eq(orders.id, j.orderId!))
        .for("update");
      const [f] = await tx
        .select()
        .from(fulfillments)
        .where(
          and(
            eq(fulfillments.id, j.fulfillmentId!),
            eq(fulfillments.organizationId, c.organizationId),
          ),
        )
        .for("update");
      if (f.providerConnectionId !== c.id)
        throw new ProviderFailure("AMBIGUOUS", false, true);
      let [s] = await tx
        .select()
        .from(shipments)
        .where(eq(shipments.fulfillmentId, f.id));
      if (!s) {
        [s] = await tx
          .insert(shipments)
          .values({
            organizationId: c.organizationId,
            orderId: j.orderId!,
            fulfillmentId: f.id,
            providerKey: c.providerKey,
            providerConnectionId: c.id,
            providerShipmentId: result.externalId,
            providerRawStatus: raw,
            integrationError: creationError,
            trackingNumber: result.trackingNumber?.slice(0, 120) ?? null,
            trackingUrl,
            lastSyncAt: new Date(),
          })
          .returning();
        await tx.insert(shipmentEvents).values({
          organizationId: c.organizationId,
          shipmentId: s.id,
          source: "poll",
          toStatus: "created",
          providerStatusRaw: raw,
        });
      } else if (s.providerShipmentId !== result.externalId)
        throw new ProviderFailure("AMBIGUOUS", false, true);
      await tx
        .insert(providerStatusEvents)
        .values({
          organizationId: c.organizationId,
          connectionId: c.id,
          shipmentId: s.id,
          eventKey: result.eventId,
          rawStatus: raw,
          normalizedStatus: mapped,
          disposition: creationError
            ? mapped
              ? "invalid_transition"
              : "unknown"
            : "duplicate",
          occurredAt: result.occurredAt,
        })
        .onConflictDoNothing();
      if (f.status !== "fulfilled") {
        await tx
          .update(fulfillments)
          .set({ status: "fulfilled", updatedAt: new Date() })
          .where(eq(fulfillments.id, f.id));
        await tx.insert(fulfillmentStateEvents).values({
          organizationId: c.organizationId,
          orderId: j.orderId!,
          fulfillmentId: f.id,
          fromStatus: f.status,
          toStatus: "fulfilled",
          note: "Provider shipment created",
        });
      }
      await tx
        .update(providerJobs)
        .set({ status: "done", leaseUntil: null, lastError: null })
        .where(eq(providerJobs.id, j.id));
      await tx
        .update(providerAttempts)
        .set({
          finishedAt: new Date(),
          success: true,
          responseIdentifier: result.externalId,
        })
        .where(eq(providerAttempts.id, attemptId));
      await tx
        .update(providerConnections)
        .set({ lastSuccessAt: new Date(), lastErrorMessage: null })
        .where(eq(providerConnections.id, c.id));
      await tx
        .insert(providerJobs)
        .values({
          organizationId: c.organizationId,
          connectionId: c.id,
          connectionRevision: c.revision,
          orderId: s.orderId,
          shipmentId: s.id,
          operation: "poll",
          dedupeKey: `poll:${s.id}`,
          status: creationError ? "investigation" : "pending",
          lastError: creationError,
          availableAt: new Date(Date.now() + 1800000),
        })
        .onConflictDoNothing();
    });
  }
  private async finishSync(
    j: typeof providerJobs.$inferSelect,
    c: typeof providerConnections.$inferSelect,
    identity: typeof shipments.$inferSelect,
    result: ProviderResult,
    attemptId: string,
  ) {
    z.string().min(1).max(180).parse(result.eventId);
    z.date().parse(result.occurredAt);
    if (result.externalId !== identity.providerShipmentId)
      throw new ProviderFailure("AMBIGUOUS", false, true);
    const raw = z.string().min(1).max(120).parse(result.rawStatus),
      normalized = this.adapter(c.id).mapProviderStatus(raw);
    const next = await this.db.transaction(async (tx) => {
      await tx
        .select()
        .from(orders)
        .where(eq(orders.id, identity.orderId))
        .for("update");
      const [s] = await tx
        .select()
        .from(shipments)
        .where(eq(shipments.id, identity.id))
        .for("update");
      const [existing] = await tx
        .select()
        .from(providerStatusEvents)
        .where(
          and(
            eq(providerStatusEvents.connectionId, c.id),
            eq(providerStatusEvents.eventKey, result.eventId),
          ),
        );
      const disposition =
        existing?.disposition ??
        (!normalized
          ? "unknown"
          : normalized === s.status
            ? "duplicate"
            : (shipmentTransitions[s.status] as readonly string[]).includes(
                  normalized,
                )
              ? "applied"
              : "invalid_transition");
      if (!existing)
        await tx.insert(providerStatusEvents).values({
          organizationId: c.organizationId,
          connectionId: c.id,
          shipmentId: s.id,
          eventKey: result.eventId,
          rawStatus: raw,
          normalizedStatus: normalized,
          disposition,
          occurredAt: result.occurredAt,
        });
      const safe =
        disposition === "unknown"
          ? safeErrors.UNKNOWN_STATUS
          : disposition === "invalid_transition"
            ? safeErrors.INVALID_TRANSITION
            : null;
      if (!existing && disposition === "applied" && normalized) {
        await tx
          .update(shipments)
          .set({
            status: normalized,
            providerRawStatus: raw,
            lastSyncAt: new Date(),
            integrationError: null,
            shippedAt: normalized === "shipped" ? new Date() : s.shippedAt,
            deliveredAt:
              normalized === "delivered" ? new Date() : s.deliveredAt,
            returnedAt: normalized === "returned" ? new Date() : s.returnedAt,
            updatedAt: new Date(),
          })
          .where(eq(shipments.id, s.id));
        await tx.insert(shipmentEvents).values({
          organizationId: c.organizationId,
          shipmentId: s.id,
          source: "poll",
          fromStatus: s.status,
          toStatus: normalized,
          providerStatusRaw: raw,
          occurredAt: result.occurredAt,
        });
      } else
        await tx
          .update(shipments)
          .set({
            providerRawStatus: raw,
            lastSyncAt: new Date(),
            integrationError: safe,
          })
          .where(eq(shipments.id, s.id));
      await tx
        .update(providerAttempts)
        .set({
          finishedAt: new Date(),
          success: !safe,
          safeError: safe,
          responseIdentifier: result.externalId,
        })
        .where(eq(providerAttempts.id, attemptId));
      const terminal = ["delivered", "returned", "cancelled"].includes(
        disposition === "applied" ? normalized! : s.status,
      );
      await tx
        .update(providerJobs)
        .set({
          status: safe ? "investigation" : terminal ? "done" : "pending",
          availableAt: new Date(Date.now() + 1800000),
          leaseUntil: null,
          lastError: safe,
        })
        .where(eq(providerJobs.id, j.id));
      await tx
        .update(providerConnections)
        .set({
          lastSuccessAt: new Date(),
          ...(safe
            ? { lastErrorAt: new Date(), lastErrorMessage: safe }
            : { lastErrorMessage: null }),
        })
        .where(eq(providerConnections.id, c.id));
      return terminal;
    });
    return next;
  }
}
