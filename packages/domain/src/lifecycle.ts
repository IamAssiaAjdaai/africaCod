export const confirmationStates = [
  "uncontacted",
  "attempted",
  "callback_due",
  "confirmed",
  "cancelled",
] as const;
export type ConfirmationState = (typeof confirmationStates)[number];
export const shipmentTransitions = {
  created: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "returned"],
  out_for_delivery: ["delivered", "delivery_failed", "refused"],
  delivery_failed: ["out_for_delivery", "returned"],
  refused: ["returned"],
  delivered: [],
  returned: [],
  cancelled: [],
} as const;
export type ShipmentStatus = keyof typeof shipmentTransitions;
export const fulfillmentTransitions = {
  pending: ["ready", "cancelled"],
  ready: ["processing", "cancelled"],
  processing: ["failed", "cancelled"],
  failed: ["processing", "cancelled"],
  fulfilled: [],
  cancelled: [],
} as const;
export type FulfillmentStatus = keyof typeof fulfillmentTransitions;
export function confirmationState(
  status: string,
  latest: { outcome: string; nextCallbackAt: Date | null } | null,
  now = new Date(),
): ConfirmationState {
  if (status === "confirmed" || status === "cancelled") return status;
  if (!latest) return "uncontacted";
  if (
    latest.outcome === "callback" &&
    latest.nextCallbackAt &&
    latest.nextCallbackAt <= now
  )
    return "callback_due";
  return "attempted";
}
export function callbackTiming(at: Date | null, now = new Date()) {
  if (!at) return null;
  if (at.getTime() < now.getTime() - 60000) return "overdue";
  if (at <= now) return "due now";
  return "upcoming";
}
// Provider adapters translate external states into these normalized logistics states.
// No credentials, network calls or provider implementations exist in this checkpoint.
export interface ShipmentProvider {
  key: string;
  validateCredentials(credentials: unknown): Promise<boolean>;
  createShipment(
    orderSnapshot: unknown,
  ): Promise<{ providerShipmentId: string; status: ShipmentStatus }>;
  getShipmentStatus(
    providerShipmentId: string,
  ): Promise<{ raw: string; status: ShipmentStatus }>;
  mapProviderStatus(raw: string): ShipmentStatus;
  verifyWebhook(
    body: Uint8Array,
    headers: Record<string, string>,
  ): Promise<boolean>;
  parseWebhook(body: Uint8Array): {
    providerShipmentId: string;
    rawStatus: string;
    occurredAt: Date;
  };
}
