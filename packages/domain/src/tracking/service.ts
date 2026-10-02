import { createHash } from "node:crypto";
import { and, eq, sql, asc, desc } from "drizzle-orm";
import { z } from "zod";
import {
  type Database,
  trackingConnections,
  commerceEvents,
  trackingJobs,
  trackingAttempts,
  trackingTestReceipts,
  sheetsTestRows,
  orders,
  orderItems,
  orderEvents,
  shipments,
  shipmentEvents,
  orderAttribution,
  stores,
} from "@africacod/db";
import { currencyDecimals } from "@africacod/shared/money";
import { ProductionMetaTransport } from "./meta";
import {
  DeterministicMetaTransport,
  DeterministicSheetsTransport,
} from "./test-adapters";
import { OperationsService } from "../operations";
import { DomainError } from "../commerce";
import { CredentialVault } from "../integrations/credentials";
import {
  metaEventName,
  trackingProviders,
  leadEventId,
  type TrackingProvider,
  type BrowserConnection,
} from "./policy";
const input = z.object({
  enabled: z.boolean(),
  pixelId: z.string().trim().max(100).default(""),
  token: z.string().trim().max(4096).default(""),
  purchaseMode: z.enum(["delivered", "disabled"]).default("disabled"),
  tagId: z.string().trim().max(50).default(""),
  leadLabel: z.string().trim().max(100).default(""),
  deliveredLabel: z.string().trim().max(100).default(""),
  destination: z.string().trim().max(200).default(""),
  failOnce: z.boolean().default(false),
});
type Connection = typeof trackingConnections.$inferSelect;
const safe = (c: Connection) => ({
  id: c.id,
  storeId: c.storeId,
  provider: c.provider,
  enabled: c.enabled,
  mode: c.mode,
  settings: c.settings,
  hasSecret: !!c.secretEncrypted,
  lastSuccess: c.lastSuccess,
  lastFailure: c.lastFailure,
  lastError: c.lastError,
});
// Production activation is independent of mock availability. No fake OAuth or guessed Meta transport.
export class TrackingService extends OperationsService {
  constructor(
    db: Database,
    private readonly runtime: { testMode: boolean; encryptionKey?: string },
  ) {
    super(db);
  }
  async connection(userId: string | null, storeId: string, provider: string) {
    await this.getStore(userId, storeId);
    const [c] = await this.db
      .select()
      .from(trackingConnections)
      .where(
        and(
          eq(trackingConnections.storeId, storeId),
          eq(
            trackingConnections.provider,
            z.enum(trackingProviders).parse(provider),
          ),
        ),
      );
    return c ? safe(c) : null;
  }
  async configureTracking(
    userId: string | null,
    storeId: string,
    provider: TrackingProvider,
    value: unknown,
  ) {
    const store = await this.getStore(userId, storeId),
      p = z.enum(trackingProviders).parse(provider),
      v = input.parse(value);
    if (
      v.enabled &&
      (((p === "meta" || p === "tiktok") &&
        !/^[A-Za-z0-9_-]+$/.test(v.pixelId)) ||
        (p === "google-ads" &&
          (!/^AW-\d+$/.test(v.tagId) ||
            !/^[A-Za-z0-9_-]+$/.test(v.leadLabel))) ||
        (p === "google-sheets" && !v.destination))
    )
      throw new DomainError(
        "INVALID_INPUT",
        "Provide the required destination or account identifiers.",
      );
    if (v.enabled && p === "meta" && !/^\d+$/.test(v.pixelId))
      throw new DomainError(
        "INVALID_INPUT",
        "Meta Pixel ID must contain digits.",
      );
    if (
      v.enabled &&
      p === "tiktok" &&
      Object.prototype.hasOwnProperty.call(Object.prototype, v.pixelId)
    )
      throw new DomainError("INVALID_INPUT", "Supply a valid TikTok Pixel ID.");
    const mode = this.runtime.testMode
      ? "mock"
      : p === "meta"
        ? "production"
        : p === "tiktok" || p === "google-ads"
          ? "browser"
          : "blocked";
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`tracking:${storeId}:${p}`}))`,
      );
      const [old] = await tx
        .select()
        .from(trackingConnections)
        .where(
          and(
            eq(trackingConnections.storeId, storeId),
            eq(trackingConnections.provider, p),
          ),
        );
      const id = old?.id ?? crypto.randomUUID(),
        context = `${store.organizationId}:${storeId}:${id}:${p}`;
      const secretEncrypted = v.token
        ? new CredentialVault(this.runtime.encryptionKey).encrypt(
            { apiKey: v.token, apiSecret: p },
            context,
          )
        : (old?.secretEncrypted ?? null);
      if (v.enabled && p === "meta" && !secretEncrypted)
        throw new DomainError(
          "INVALID_INPUT",
          "Supply a CAPI token. It is stored encrypted and never returned.",
        );
      const settings = {
        pixelId: v.pixelId,
        purchaseMode: v.purchaseMode,
        tagId: v.tagId,
        leadLabel: v.leadLabel,
        deliveredLabel: v.deliveredLabel,
        destination: v.destination,
        failOnce: this.runtime.testMode && v.failOnce ? "1" : "0",
      };
      const [saved] = await tx
        .insert(trackingConnections)
        .values({
          id,
          organizationId: store.organizationId,
          storeId,
          provider: p,
          enabled: v.enabled,
          mode,
          settings,
          secretEncrypted,
        })
        .onConflictDoUpdate({
          target: [trackingConnections.storeId, trackingConnections.provider],
          set: {
            enabled: v.enabled,
            mode,
            settings,
            secretEncrypted,
            revision: (old?.revision ?? 0) + 1,
            enabledAt: new Date(),
            lastSuccess: null,
            lastError:
              mode === "blocked"
                ? "Production activation requires verified provider setup."
                : null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return safe(saved);
    });
  }
  async publicTracking(storeSlug: string): Promise<BrowserConnection[]> {
    const rows = await this.db
      .select({ connection: trackingConnections })
      .from(trackingConnections)
      .innerJoin(stores, eq(stores.id, trackingConnections.storeId))
      .where(
        and(eq(stores.slug, storeSlug), eq(trackingConnections.enabled, true)),
      );
    return rows
      .filter(
        ({ connection: c }) =>
          c.provider !== "google-sheets" &&
          c.mode !== "blocked" &&
          (c.mode !== "mock" || this.runtime.testMode),
      )
      .map(({ connection: c }) => ({
        provider: c.provider as TrackingProvider,
        mode: c.mode,
        settings: {
          pixelId: c.settings.pixelId,
          tagId: c.settings.tagId,
          leadLabel: c.settings.leadLabel,
        },
      }));
  }
  async health(
    userId: string | null,
    storeId: string,
    provider: TrackingProvider,
  ) {
    const c = await this.connection(userId, storeId, provider);
    if (!c) return { connection: null, events: [], rows: [] };
    const events = await this.db
      .select({
        id: trackingJobs.id,
        type: commerceEvents.type,
        status: trackingJobs.status,
        attempts: trackingJobs.attempts,
        error: trackingJobs.safeError,
        occurredAt: commerceEvents.occurredAt,
        eventName: trackingTestReceipts.eventName,
        payload: trackingTestReceipts.payload,
      })
      .from(trackingJobs)
      .innerJoin(commerceEvents, eq(commerceEvents.id, trackingJobs.eventId))
      .leftJoin(
        trackingTestReceipts,
        and(
          eq(trackingTestReceipts.connectionId, c.id),
          eq(trackingTestReceipts.eventId, trackingJobs.eventId),
        ),
      )
      .where(eq(trackingJobs.connectionId, c.id))
      .orderBy(desc(commerceEvents.occurredAt))
      .limit(30);
    // No raw payload projection, even for tests; only safe business event facts.
    return {
      connection: c,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        status: e.status,
        attempts: e.attempts,
        error: e.error,
        occurredAt: e.occurredAt,
        eventName: e.eventName,
        eventId:
          typeof e.payload?.event_id === "string" ? e.payload.event_id : null,
        value: (e.payload?.custom_data as { value?: number } | undefined)
          ?.value,
        currency: (e.payload?.custom_data as { currency?: string } | undefined)
          ?.currency,
      })),
      rows: await this.db
        .select({
          orderNumber: sheetsTestRows.orderNumber,
          columns: sheetsTestRows.columns,
        })
        .from(sheetsTestRows)
        .where(eq(sheetsTestRows.connectionId, c.id))
        .limit(100),
    };
  }
  // Histories committed by checkout/operations form the durable source outbox. Anti-joins are bounded and replayable.
  async materialize(organizationId?: string) {
    const history = await this.db
      .select({ history: orderEvents, order: orders })
      .from(orderEvents)
      .innerJoin(orders, eq(orders.id, orderEvents.orderId))
      .where(
        and(
          organizationId
            ? eq(orders.organizationId, organizationId)
            : undefined,
          sql`NOT EXISTS (SELECT 1 FROM commerce_events WHERE id = 'order:' || ${orderEvents.id}::text)`,
        ),
      )
      .orderBy(asc(orderEvents.createdAt))
      .limit(100);
    for (const { history: h, order: o } of history) {
      await this.db.transaction(async (tx) => {
        await tx
          .insert(commerceEvents)
          .values({
            id: `order:${h.id}`,
            organizationId: o.organizationId,
            storeId: o.storeId,
            orderId: o.id,
            type:
              h.status === "new"
                ? "order_created"
                : h.status === "confirmed"
                  ? "order_confirmed"
                  : "shipment_changed",
            occurredAt: h.createdAt,
          })
          .onConflictDoNothing();
        if (h.status === "new")
          await tx
            .insert(commerceEvents)
            .values({
              id: leadEventId(o.orderNumber),
              organizationId: o.organizationId,
              storeId: o.storeId,
              orderId: o.id,
              type: "checkout_submitted",
              occurredAt: h.createdAt,
            })
            .onConflictDoNothing();
      });
    }
    const changes = await this.db
      .select({ history: shipmentEvents, order: orders })
      .from(shipmentEvents)
      .innerJoin(shipments, eq(shipments.id, shipmentEvents.shipmentId))
      .innerJoin(orders, eq(orders.id, shipments.orderId))
      .where(
        and(
          organizationId
            ? eq(orders.organizationId, organizationId)
            : undefined,
          sql`NOT EXISTS (SELECT 1 FROM commerce_events WHERE id = 'shipment:' || ${shipmentEvents.id}::text)`,
        ),
      )
      .orderBy(asc(shipmentEvents.occurredAt))
      .limit(100);
    for (const { history: h, order: o } of changes)
      await this.db
        .insert(commerceEvents)
        .values({
          id: `shipment:${h.id}`,
          organizationId: o.organizationId,
          storeId: o.storeId,
          orderId: o.id,
          type: [
            "created",
            "shipped",
            "out_for_delivery",
            "delivered",
            "refused",
            "returned",
          ].includes(h.toStatus)
            ? `shipment_${h.toStatus}`
            : "shipment_changed",
          occurredAt: h.occurredAt,
        })
        .onConflictDoNothing();
    await this.db.execute(
      sql`INSERT INTO tracking_jobs (organization_id,store_id,connection_id,event_id,revision) SELECT e.organization_id,e.store_id,c.id,e.id,c.revision FROM commerce_events e JOIN tracking_connections c ON c.store_id=e.store_id AND c.organization_id=e.organization_id WHERE c.enabled AND e.occurred_at>=c.enabled_at AND e.order_id IS NOT NULL AND ((${organizationId ?? null}::uuid IS NULL) OR e.organization_id=${organizationId ?? null}::uuid) AND ((c.provider='meta' AND (e.type='checkout_submitted' OR (e.type='shipment_delivered' AND c.settings->>'purchaseMode'='delivered'))) OR c.provider='google-sheets') ON CONFLICT (connection_id,event_id) DO NOTHING`,
    );
    return history.length + changes.length;
  }
  async recordProductView(
    storeSlug: string,
    productSlug: string,
    market: string | undefined,
    eventId: string,
  ) {
    z.uuid().parse(eventId);
    const product = await this.getPublicProduct(storeSlug, productSlug, market);
    if (!product.selected)
      throw new DomainError("NOT_FOUND", "Select an available market.");
    const [s] = await this.db
      .select()
      .from(stores)
      .where(eq(stores.slug, storeSlug));
    await this.db
      .insert(commerceEvents)
      .values({
        id: `view:${eventId}`,
        organizationId: s.organizationId,
        storeId: s.id,
        type: "product_viewed",
        occurredAt: new Date(),
      })
      .onConflictDoNothing();
  }
  async runOne(organizationId?: string) {
    await this.materialize(organizationId);
    return this.db.transaction(async (tx) => {
      // Transaction row lock owns a job across adapter IO. Crash rolls back locally; remote dedupe uses immutable event ID.
      const [j] = await tx
        .select()
        .from(trackingJobs)
        .where(
          and(
            organizationId
              ? eq(trackingJobs.organizationId, organizationId)
              : undefined,
            sql`${trackingJobs.status} IN ('pending','processing') AND ${trackingJobs.availableAt} <= now()`,
          ),
        )
        .orderBy(asc(trackingJobs.availableAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!j) return false;
      const [c] = await tx
        .select()
        .from(trackingConnections)
        .where(eq(trackingConnections.id, j.connectionId))
        .for("update");
      if (!c.enabled || c.revision !== j.revision) {
        await tx
          .update(trackingJobs)
          .set({
            status: "skipped",
            safeError: "Connection disabled or reconfigured.",
          })
          .where(eq(trackingJobs.id, j.id));
        return true;
      }
      const [event] = await tx
        .select()
        .from(commerceEvents)
        .where(eq(commerceEvents.id, j.eventId));
      const [o] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, event.orderId!));
      const [attempt] = await tx
        .insert(trackingAttempts)
        .values({ jobId: j.id })
        .returning();
      await tx
        .update(trackingJobs)
        .set({ attempts: j.attempts + 1, status: "processing" })
        .where(eq(trackingJobs.id, j.id));
      try {
        if (
          c.mode === "blocked" ||
          c.mode === "browser" ||
          (c.mode === "mock" && !this.runtime.testMode)
        )
          throw new Error(
            "Production delivery is blocked; provider authorization is required.",
          );
        if (c.secretEncrypted)
          new CredentialVault(this.runtime.encryptionKey).decrypt(
            c.secretEncrypted,
            `${c.organizationId}:${c.storeId}:${c.id}:${c.provider}`,
          );
        if (c.provider === "meta") {
          const name = metaEventName(event.type, c.settings.purchaseMode);
          if (!name) throw new Error("Event policy disallows delivery.");
          // Purchase authorization is rechecked against current internal shipment truth.
          const [shipment] = await tx
            .select()
            .from(shipments)
            .where(eq(shipments.orderId, o.id));
          if (name === "Purchase" && shipment?.status !== "delivered") {
            await tx
              .update(trackingJobs)
              .set({ status: "skipped" })
              .where(eq(trackingJobs.id, j.id));
            return true;
          }
          const [attribution] = await tx
            .select()
            .from(orderAttribution)
            .where(eq(orderAttribution.orderId, o.id));
          const user_data: Record<string, unknown> = {
            ph: [
              createHash("sha256")
                .update(o.phone.replace(/\D/g, ""))
                .digest("hex"),
            ],
          };
          if (attribution?.fbp) user_data.fbp = attribution.fbp;
          if (attribution?.fbc) user_data.fbc = attribution.fbc;
          else if (attribution?.fbclid)
            user_data.fbc = `fb.1.${o.createdAt.getTime()}.${attribution.fbclid}`;
          if (attribution?.userAgent)
            user_data.client_user_agent = attribution.userAgent;
          let source: string | undefined;
          try {
            const u = new URL(attribution?.landingUrl ?? "");
            if (u.protocol === "https:" || u.protocol === "http:")
              source = u.origin + u.pathname;
          } catch {}
          const payload: Record<string, unknown> = {
            event_name: name,
            event_id: event.id,
            event_time: Math.floor(event.occurredAt.getTime() / 1000),
            action_source: name === "Purchase" ? "other" : "website",
            user_data,
            ...(source ? { event_source_url: source } : {}),
            ...(name === "Purchase"
              ? {
                  custom_data: {
                    currency: o.currency,
                    value: o.totalMinor / 10 ** currencyDecimals(o.currency),
                  },
                }
              : {}),
          };
          if (c.mode === "mock")
            await new DeterministicMetaTransport(tx, c.id).send(
              c.settings.pixelId,
              "",
              payload,
            );
          else {
            if (name === "Lead" && (!source || !attribution?.userAgent))
              throw new Error("Required website context missing.");
            const secret = new CredentialVault(
              this.runtime.encryptionKey,
            ).decrypt(
              c.secretEncrypted!,
              `${c.organizationId}:${c.storeId}:${c.id}:${c.provider}`,
            );
            await new ProductionMetaTransport().send(
              c.settings.pixelId,
              secret.apiKey,
              payload,
            );
          }
        } else if (c.provider === "google-sheets") {
          const items = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, o.id));
          const [shipment] = await tx
            .select()
            .from(shipments)
            .where(eq(shipments.orderId, o.id));
          const [store] = await tx
            .select()
            .from(stores)
            .where(eq(stores.id, o.storeId));
          const [attr] = await tx
            .select()
            .from(orderAttribution)
            .where(eq(orderAttribution.orderId, o.id));
          const columns = {
            "Order Number": o.orderNumber,
            "Created At": o.createdAt.toISOString(),
            Store: store.name,
            Market: o.marketName,
            Customer: o.customerName,
            Phone: o.phone,
            Product: items.map((i) => i.productName).join(", "),
            Quantity: items.reduce((s, i) => s + i.quantity, 0),
            "Order Total": o.totalMinor / 10 ** currencyDecimals(o.currency),
            Currency: o.currency,
            "Order Status": o.status,
            "Confirmation State": o.confirmedAt
              ? "confirmed"
              : o.status === "cancelled"
                ? "cancelled"
                : "awaiting",
            "Shipment Status": shipment?.status ?? "",
            "Tracking Number": shipment?.trackingNumber ?? "",
            "UTM Source": attr?.utmSource ?? "",
            "UTM Campaign": attr?.utmCampaign ?? "",
          };
          await new DeterministicSheetsTransport(tx, c.id).upsert(
            c.settings.destination,
            columns,
          );
        }
        // Simulate acceptance with a lost response once. Stable adapter receipt/row survives and is not duplicated on retry.
        if (c.settings.failOnce === "1" && j.attempts === 0)
          throw new Error(
            "Test adapter accepted the event but the response was interrupted.",
          );
        await tx
          .update(trackingJobs)
          .set({ status: "done", safeError: null })
          .where(eq(trackingJobs.id, j.id));
        await tx
          .update(trackingAttempts)
          .set({ finishedAt: new Date(), success: true })
          .where(eq(trackingAttempts.id, attempt.id));
        await tx
          .update(trackingConnections)
          .set({ lastSuccess: new Date(), lastError: null })
          .where(eq(trackingConnections.id, c.id));
      } catch (error) {
        const safeError =
          error instanceof Error && error.message.startsWith("Test adapter")
            ? "Test adapter response interrupted; retry scheduled."
            : c.mode === "blocked"
              ? "Production delivery blocked: provider setup required."
              : c.mode === "production"
                ? "Meta delivery failed; check account configuration."
                : "Test adapter delivery failed.";
        await tx
          .update(trackingJobs)
          .set({
            status:
              j.attempts >= 4 || c.mode === "blocked" ? "failed" : "pending",
            safeError,
            availableAt: new Date(
              Date.now() + Math.min(60000, 1000 * 2 ** j.attempts),
            ),
          })
          .where(eq(trackingJobs.id, j.id));
        await tx
          .update(trackingAttempts)
          .set({ finishedAt: new Date(), success: false, safeError })
          .where(eq(trackingAttempts.id, attempt.id));
        await tx
          .update(trackingConnections)
          .set({ lastError: safeError, lastFailure: new Date() })
          .where(eq(trackingConnections.id, c.id));
      }
      return true;
    });
  }
}
