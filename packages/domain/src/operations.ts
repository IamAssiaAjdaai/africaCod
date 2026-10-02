import {
  and,
  eq,
  desc,
  asc,
  sql,
  count,
  ilike,
  or,
  gte,
  lte,
} from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  orders,
  orderEvents,
  memberships,
  user,
  stores,
  confirmationAttempts,
  fulfillments,
  fulfillmentStateEvents,
  shipments,
  shipmentEvents,
} from "@africacod/db";
import { orderFiltersInput } from "@africacod/validation";
import { ContentService } from "./content";
import { DomainError } from "./commerce";
import {
  confirmationState,
  callbackTiming,
  confirmationStates,
  shipmentTransitions,
  fulfillmentTransitions,
  type ShipmentStatus,
  type FulfillmentStatus,
} from "./lifecycle";
export const cancellationReasons = [
  "customer_cancelled",
  "invalid_order",
  "duplicate",
  "merchant_rejected",
  "unreachable",
  "other",
] as const;
const attemptInput = z
  .object({
    outcome: z.enum([
      "no_answer",
      "callback",
      "confirmed",
      "cancelled",
      "invalid_order",
    ]),
    note: z.string().trim().max(2000).nullable().default(null),
    nextCallbackAt: z.coerce.date().nullable().default(null),
    reason: z.enum(cancellationReasons).nullable().default(null),
    requestKey: z.uuid(),
  })
  .superRefine((v, c) => {
    if (v.outcome === "callback" && !v.nextCallbackAt)
      c.addIssue({
        code: "custom",
        message: "A callback date and time are required.",
      });
    if (["cancelled", "invalid_order"].includes(v.outcome) && !v.reason)
      c.addIssue({ code: "custom", message: "Choose a cancellation reason." });
  });
const trackingInput = z.object({
  trackingNumber: z.string().trim().max(120).nullable().default(null),
  trackingUrl: z
    .url()
    .max(2000)
    .refine(
      (v) => ["http:", "https:"].includes(new URL(v).protocol),
      "Use an HTTP or HTTPS tracking URL.",
    )
    .nullable()
    .default(null),
});
export const operationalFiltersInput = orderFiltersInput.extend({
  confirmation: z.enum(confirmationStates).optional(),
  fulfillment: z
    .enum([
      "none",
      "pending",
      "ready",
      "processing",
      "fulfilled",
      "failed",
      "cancelled",
    ])
    .optional(),
  shipment: z
    .enum([
      "none",
      "created",
      "shipped",
      "out_for_delivery",
      "delivery_failed",
      "delivered",
      "refused",
      "returned",
      "cancelled",
    ])
    .optional(),
  agent: z.union([z.uuid(), z.literal("unassigned")]).optional(),
  callbacks: z.enum(["due", "upcoming", "all"]).optional(),
});
// Only the latest attempt governs callback scheduling. A new no-answer attempt supersedes an old callback.
const latestOutcome = sql<
  string | null
>`(select a.outcome::text from confirmation_attempts a where a.order_id = ${orders.id} and a.organization_id = ${orders.organizationId} order by a.attempted_at desc, a.id desc limit 1)`;
const latestCallback = sql<
  string | null
>`(select a.next_callback_at from confirmation_attempts a where a.order_id = ${orders.id} and a.organization_id = ${orders.organizationId} order by a.attempted_at desc, a.id desc limit 1)`;
const derived = sql<string>`case when ${orders.status} = 'confirmed' then 'confirmed' when ${orders.status} = 'cancelled' then 'cancelled' when ${latestOutcome} is null then 'uncontacted' when ${latestOutcome} = 'callback' and ${latestCallback} <= now() then 'callback_due' else 'attempted' end`;
export class OperationsService extends ContentService {
  async listAgents(userId: string | null) {
    const org = await this.tenant(userId);
    return this.db
      .select({ id: memberships.id, name: user.name, role: memberships.role })
      .from(memberships)
      .innerJoin(user, eq(user.id, memberships.userId))
      .where(eq(memberships.organizationId, org.id))
      .orderBy(asc(user.name));
  }
  async assignOrder(
    userId: string | null,
    orderId: string,
    agentId: string | null,
  ) {
    const org = await this.tenant(userId);
    z.uuid().parse(orderId);
    if (agentId) z.uuid().parse(agentId);
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.organizationId, org.id)))
        .for("update");
      if (!order) throw new DomainError("NOT_FOUND", "Order not found.");
      if (agentId) {
        const [member] = await tx
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.id, agentId),
              eq(memberships.organizationId, org.id),
            ),
          )
          .for("share");
        if (!member)
          throw new DomainError(
            "NOT_FOUND",
            "Agent not found in this organization.",
          );
      }
      if (order.status !== "new")
        throw new DomainError(
          "INVALID_INPUT",
          "Only new orders can be reassigned.",
        );
      await tx
        .update(orders)
        .set({ assignedMembershipId: agentId, updatedAt: new Date() })
        .where(eq(orders.id, order.id));
    });
  }
  async recordAttempt(userId: string | null, orderId: string, input: unknown) {
    const org = await this.tenant(userId);
    z.uuid().parse(orderId);
    const value = attemptInput.parse(input);
    const hash = createHash("sha256")
      .update(JSON.stringify({ ...value, requestKey: undefined }))
      .digest("hex");
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.organizationId, org.id)))
        .for("update");
      if (!order) throw new DomainError("NOT_FOUND", "Order not found.");
      const [existing] = await tx
        .select()
        .from(confirmationAttempts)
        .where(
          and(
            eq(confirmationAttempts.orderId, order.id),
            eq(confirmationAttempts.requestKey, value.requestKey),
            eq(confirmationAttempts.organizationId, org.id),
          ),
        );
      if (existing) {
        if (existing.requestHash !== hash)
          throw new DomainError(
            "CONFLICT",
            "This attempt key was already used for a different request.",
          );
        return order;
      }
      if (order.status !== "new") {
        if (order.status === "confirmed" && value.outcome === "confirmed")
          return order;
        throw new DomainError(
          "INVALID_INPUT",
          "Only new orders accept confirmation attempts. Reversal is not supported.",
        );
      }
      const [agent] = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, org.id),
            eq(memberships.userId, userId!),
          ),
        )
        .for("share");
      const now = new Date(); // Order lock serializes timestamp ordering and all confirmation side effects.
      await tx.insert(confirmationAttempts).values({
        organizationId: org.id,
        orderId: order.id,
        agentMembershipId: agent.id,
        requestKey: value.requestKey,
        requestHash: hash,
        outcome: value.outcome,
        note: value.note,
        nextCallbackAt:
          value.outcome === "callback" ? value.nextCallbackAt : null,
        attemptedAt: sql`clock_timestamp()`,
      });
      const status =
        value.outcome === "confirmed"
          ? "confirmed"
          : ["cancelled", "invalid_order"].includes(value.outcome)
            ? "cancelled"
            : null;
      if (!status) return order;
      const [updated] = await tx
        .update(orders)
        .set({
          status,
          confirmedAt: status === "confirmed" ? now : null,
          cancelledAt: status === "cancelled" ? now : null,
          cancellationReason: status === "cancelled" ? value.reason : null,
          updatedAt: now,
        })
        .where(eq(orders.id, order.id))
        .returning();
      await tx.insert(orderEvents).values({
        organizationId: org.id,
        orderId: order.id,
        status,
        message:
          status === "confirmed"
            ? "Order confirmed"
            : `Order cancelled: ${value.reason}`,
      });
      return updated;
    });
  }
  async createFulfillment(userId: string | null, orderId: string) {
    const org = await this.tenant(userId);
    z.uuid().parse(orderId);
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.organizationId, org.id)))
        .for("update");
      if (!order) throw new DomainError("NOT_FOUND", "Order not found.");
      if (order.status !== "confirmed")
        throw new DomainError(
          "INVALID_INPUT",
          "Confirm the order before creating fulfillment.",
        );
      const [existing] = await tx
        .select()
        .from(fulfillments)
        .where(eq(fulfillments.orderId, order.id));
      if (existing)
        throw new DomainError(
          "CONFLICT",
          "This order already has a fulfillment.",
        );
      const [f] = await tx
        .insert(fulfillments)
        .values({ organizationId: org.id, orderId: order.id, status: "ready" })
        .returning();
      await tx.insert(fulfillmentStateEvents).values({
        organizationId: org.id,
        orderId: order.id,
        fulfillmentId: f.id,
        toStatus: "ready",
        note: "Manual fulfillment created",
      });
      return f;
    });
  }
  async transitionFulfillment(
    userId: string | null,
    orderId: string,
    target: FulfillmentStatus,
  ) {
    const org = await this.tenant(userId);
    z.uuid().parse(orderId);
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.organizationId, org.id)))
        .for("update");
      if (!order) throw new DomainError("NOT_FOUND", "Order not found.");
      const [f] = await tx
        .select()
        .from(fulfillments)
        .where(
          and(
            eq(fulfillments.orderId, order.id),
            eq(fulfillments.organizationId, org.id),
          ),
        )
        .for("update");
      if (!f) throw new DomainError("NOT_FOUND", "Fulfillment not found.");
      if (target === f.status) return f;
      if (
        !(fulfillmentTransitions[f.status] as readonly string[]).includes(
          target,
        )
      )
        throw new DomainError(
          "INVALID_INPUT",
          "Invalid fulfillment transition.",
        );
      const [updated] = await tx
        .update(fulfillments)
        .set({ status: target, updatedAt: new Date() })
        .where(eq(fulfillments.id, f.id))
        .returning();
      await tx.insert(fulfillmentStateEvents).values({
        organizationId: org.id,
        orderId: order.id,
        fulfillmentId: f.id,
        fromStatus: f.status,
        toStatus: target,
      });
      return updated;
    });
  }
  async createManualShipment(
    userId: string | null,
    orderId: string,
    input: unknown = {},
  ) {
    const org = await this.tenant(userId);
    z.uuid().parse(orderId);
    const tracking = trackingInput.parse(input);
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.organizationId, org.id)))
        .for("update");
      if (!order) throw new DomainError("NOT_FOUND", "Order not found.");
      if (order.status !== "confirmed")
        throw new DomainError(
          "INVALID_INPUT",
          "Shipment requires a confirmed order.",
        );
      const [f] = await tx
        .select()
        .from(fulfillments)
        .where(
          and(
            eq(fulfillments.orderId, order.id),
            eq(fulfillments.organizationId, org.id),
          ),
        )
        .for("update");
      if (!f)
        throw new DomainError("INVALID_INPUT", "Create a fulfillment first.");
      const [existing] = await tx
        .select()
        .from(shipments)
        .where(eq(shipments.fulfillmentId, f.id));
      if (existing) {
        if (
          existing.trackingNumber === tracking.trackingNumber &&
          existing.trackingUrl === tracking.trackingUrl
        )
          return existing;
        throw new DomainError(
          "CONFLICT",
          "This fulfillment already has a shipment.",
        );
      }
      if (!["pending", "ready", "processing"].includes(f.status))
        throw new DomainError(
          "INVALID_INPUT",
          "This fulfillment cannot create a shipment.",
        );
      const [shipment] = await tx
        .insert(shipments)
        .values({
          organizationId: org.id,
          orderId: order.id,
          fulfillmentId: f.id,
          ...tracking,
        })
        .returning();
      await tx.insert(shipmentEvents).values({
        organizationId: org.id,
        shipmentId: shipment.id,
        toStatus: "created",
      });
      await tx
        .update(fulfillments)
        .set({ status: "fulfilled", updatedAt: new Date() })
        .where(eq(fulfillments.id, f.id));
      await tx.insert(fulfillmentStateEvents).values({
        organizationId: org.id,
        orderId: order.id,
        fulfillmentId: f.id,
        fromStatus: f.status,
        toStatus: "fulfilled",
        note: "Manual shipment created",
      });
      return shipment;
    });
  }
  async transitionShipment(
    userId: string | null,
    shipmentId: string,
    target: ShipmentStatus,
  ) {
    const org = await this.tenant(userId);
    z.uuid().parse(shipmentId);
    const [identity] = await this.db
      .select({ orderId: shipments.orderId })
      .from(shipments)
      .where(
        and(eq(shipments.id, shipmentId), eq(shipments.organizationId, org.id)),
      );
    if (!identity) throw new DomainError("NOT_FOUND", "Shipment not found.");
    return this.db.transaction(async (tx) => {
      await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, identity.orderId),
            eq(orders.organizationId, org.id),
          ),
        )
        .for("update");
      const [shipment] = await tx
        .select()
        .from(shipments)
        .where(
          and(
            eq(shipments.id, shipmentId),
            eq(shipments.organizationId, org.id),
          ),
        )
        .for("update");
      if (target === shipment.status) return shipment;
      if (
        !(shipmentTransitions[shipment.status] as readonly string[]).includes(
          target,
        )
      )
        throw new DomainError("INVALID_INPUT", "Invalid shipment transition.");
      const now = new Date();
      const [updated] = await tx
        .update(shipments)
        .set({
          status: target,
          shippedAt: target === "shipped" ? now : shipment.shippedAt,
          deliveredAt: target === "delivered" ? now : shipment.deliveredAt,
          returnedAt: target === "returned" ? now : shipment.returnedAt,
          updatedAt: now,
        })
        .where(eq(shipments.id, shipment.id))
        .returning();
      await tx.insert(shipmentEvents).values({
        organizationId: org.id,
        shipmentId: shipment.id,
        fromStatus: shipment.status,
        toStatus: target,
        occurredAt: now,
      });
      return updated;
    });
  }
  async getOperations(userId: string | null, orderId: string) {
    const detail = await this.getOrder(userId, orderId);
    const org = await this.tenant(userId);
    const [attempts, f, s, fe] = await Promise.all([
      this.db
        .select({ attempt: confirmationAttempts, agentName: user.name })
        .from(confirmationAttempts)
        .innerJoin(
          memberships,
          eq(memberships.id, confirmationAttempts.agentMembershipId),
        )
        .innerJoin(user, eq(user.id, memberships.userId))
        .where(
          and(
            eq(confirmationAttempts.orderId, orderId),
            eq(confirmationAttempts.organizationId, org.id),
          ),
        )
        .orderBy(
          desc(confirmationAttempts.attemptedAt),
          desc(confirmationAttempts.id),
        ),
      this.db
        .select()
        .from(fulfillments)
        .where(
          and(
            eq(fulfillments.orderId, orderId),
            eq(fulfillments.organizationId, org.id),
          ),
        ),
      this.db
        .select()
        .from(shipments)
        .where(
          and(
            eq(shipments.orderId, orderId),
            eq(shipments.organizationId, org.id),
          ),
        ),
      this.db
        .select()
        .from(fulfillmentStateEvents)
        .where(
          and(
            eq(fulfillmentStateEvents.orderId, orderId),
            eq(fulfillmentStateEvents.organizationId, org.id),
          ),
        )
        .orderBy(asc(fulfillmentStateEvents.createdAt)),
    ]);
    const shipment = s[0] ?? null;
    const se = shipment
      ? await this.db
          .select()
          .from(shipmentEvents)
          .where(
            and(
              eq(shipmentEvents.shipmentId, shipment.id),
              eq(shipmentEvents.organizationId, org.id),
            ),
          )
          .orderBy(asc(shipmentEvents.occurredAt), asc(shipmentEvents.id))
      : [];
    const latest = attempts[0]?.attempt ?? null;
    const callback =
      detail.order.status === "new" && latest?.outcome === "callback"
        ? latest.nextCallbackAt
        : null;
    return {
      ...detail,
      attempts,
      fulfillment: f[0] ?? null,
      shipment,
      fulfillmentEvents: fe,
      shipmentEvents: se,
      confirmation: confirmationState(detail.order.status, latest),
      nextCallbackAt: callback,
      callbackTiming: callbackTiming(callback),
    };
  }
  async listOperationalOrders(userId: string | null, input: unknown = {}) {
    const org = await this.tenant(userId),
      filter = operationalFiltersInput.parse(input);
    if (filter.storeId) await this.getStore(userId, filter.storeId);
    const conditions = and(
      eq(orders.organizationId, org.id),
      filter.storeId ? eq(orders.storeId, filter.storeId) : undefined,
      filter.marketId ? eq(orders.storeMarketId, filter.marketId) : undefined,
      filter.status ? eq(orders.status, filter.status) : undefined,
      filter.confirmation
        ? sql`${derived} = ${filter.confirmation}`
        : undefined,
      filter.fulfillment
        ? filter.fulfillment === "none"
          ? sql`${fulfillments.id} is null`
          : eq(fulfillments.status, filter.fulfillment)
        : undefined,
      filter.shipment
        ? filter.shipment === "none"
          ? sql`${shipments.id} is null`
          : eq(shipments.status, filter.shipment)
        : undefined,
      filter.agent
        ? filter.agent === "unassigned"
          ? sql`${orders.assignedMembershipId} is null`
          : eq(orders.assignedMembershipId, filter.agent)
        : undefined,
      filter.callbacks
        ? sql`${orders.status} = 'new' and ${latestOutcome} = 'callback' and ${latestCallback} is not null ${filter.callbacks === "due" ? sql`and ${latestCallback} <= now()` : filter.callbacks === "upcoming" ? sql`and ${latestCallback} > now()` : sql``}`
        : undefined,
      filter.dateFrom
        ? gte(orders.createdAt, new Date(`${filter.dateFrom}T00:00:00Z`))
        : undefined,
      filter.dateTo
        ? lte(orders.createdAt, new Date(`${filter.dateTo}T23:59:59.999Z`))
        : undefined,
      filter.search
        ? or(
            ...[orders.orderNumber, orders.phone, orders.customerName].map(
              (c) => ilike(c, `%${filter.search.replace(/[\\%_]/g, "\\$&")}%`),
            ),
          )
        : undefined,
    );
    const rows = await this.db
      .select({
        order: orders,
        storeName: stores.name,
        productName: sql<string>`(select i.product_name from order_items i where i.order_id = ${orders.id} and i.organization_id = ${orders.organizationId} order by i.id limit 1)`,
        confirmation: derived,
        nextCallbackAt: sql<
          string | null
        >`case when ${orders.status} = 'new' and ${latestOutcome} = 'callback' then ${latestCallback} else null end`,
        fulfillmentStatus: fulfillments.status,
        shipmentStatus: shipments.status,
        agentName: user.name,
      })
      .from(orders)
      .innerJoin(
        stores,
        and(eq(stores.id, orders.storeId), eq(stores.organizationId, org.id)),
      )
      .leftJoin(
        fulfillments,
        and(
          eq(fulfillments.orderId, orders.id),
          eq(fulfillments.organizationId, org.id),
        ),
      )
      .leftJoin(
        shipments,
        and(
          eq(shipments.orderId, orders.id),
          eq(shipments.organizationId, org.id),
        ),
      )
      .leftJoin(memberships, eq(memberships.id, orders.assignedMembershipId))
      .leftJoin(user, eq(user.id, memberships.userId))
      .where(conditions)
      .orderBy(
        filter.callbacks
          ? sql`${latestCallback} asc nulls last`
          : desc(orders.createdAt),
        desc(orders.id),
      )
      .limit(20)
      .offset((filter.page - 1) * 20);
    const [total] = await this.db
      .select({ total: count() })
      .from(orders)
      .leftJoin(
        fulfillments,
        and(
          eq(fulfillments.orderId, orders.id),
          eq(fulfillments.organizationId, org.id),
        ),
      )
      .leftJoin(
        shipments,
        and(
          eq(shipments.orderId, orders.id),
          eq(shipments.organizationId, org.id),
        ),
      )
      .where(conditions);
    return { rows, total: total.total, page: filter.page, pageSize: 20 };
  }
  async operationalMetrics(userId: string | null) {
    const org = await this.tenant(userId);
    const [metrics] = await this.db
      .select({
        orders: count(),
        new: sql<number>`count(*) filter(where ${orders.status} = 'new')::int`,
        confirmed: sql<number>`count(*) filter(where ${orders.status} = 'confirmed')::int`,
        cancelled: sql<number>`count(*) filter(where ${orders.status} = 'cancelled')::int`,
        callbackDue: sql<number>`count(*) filter(where ${derived} = 'callback_due')::int`,
        callbacksUpcoming: sql<number>`count(*) filter(where ${orders.status} = 'new' and ${latestOutcome} = 'callback' and ${latestCallback} > now())::int`,
        ready: sql<number>`count(*) filter(where ${orders.status} = 'confirmed' and (${fulfillments.id} is null or ${fulfillments.status} = 'ready'))::int`,
        shipped: sql<number>`count(*) filter(where ${shipments.status} = 'shipped')::int`,
        outForDelivery: sql<number>`count(*) filter(where ${shipments.status} = 'out_for_delivery')::int`,
        delivered: sql<number>`count(*) filter(where ${shipments.status} = 'delivered')::int`,
        refused: sql<number>`count(*) filter(where ${shipments.status} = 'refused')::int`,
        returned: sql<number>`count(*) filter(where ${shipments.status} = 'returned')::int`,
      })
      .from(orders)
      .leftJoin(
        fulfillments,
        and(
          eq(fulfillments.orderId, orders.id),
          eq(fulfillments.organizationId, org.id),
        ),
      )
      .leftJoin(
        shipments,
        and(
          eq(shipments.orderId, orders.id),
          eq(shipments.organizationId, org.id),
        ),
      )
      .where(eq(orders.organizationId, org.id));
    const revenue = await this.db
      .select({
        currency: orders.currency,
        totalMinor: sql<string>`sum(${orders.totalMinor})::text`,
      })
      .from(orders)
      .innerJoin(
        shipments,
        and(
          eq(shipments.orderId, orders.id),
          eq(shipments.organizationId, org.id),
        ),
      )
      .where(
        and(
          eq(orders.organizationId, org.id),
          eq(shipments.status, "delivered"),
        ),
      )
      .groupBy(orders.currency);
    return { ...metrics, revenue };
  }
}
