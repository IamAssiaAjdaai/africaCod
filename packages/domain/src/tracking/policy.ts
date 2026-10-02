export const trackingProviders = [
  "meta",
  "tiktok",
  "google-ads",
  "google-sheets",
] as const;
export type TrackingProvider = (typeof trackingProviders)[number];
export type BrowserConnection = {
  provider: TrackingProvider;
  mode: string;
  settings: Record<string, string>;
};
export const leadEventId = (orderNumber: string) => `checkout:${orderNumber}`;
export function metaEventName(type: string, purchaseMode: string) {
  if (type === "checkout_submitted") return "Lead";
  if (type === "shipment_delivered" && purchaseMode === "delivered")
    return "Purchase";
  return null;
}
export function browserEvents(
  connections: BrowserConnection[],
  phase: "view" | "checkout",
  orderNumber?: string,
) {
  return connections.flatMap((c) => {
    if (c.mode === "blocked" || c.provider === "google-sheets") return [];
    const names =
      c.provider === "meta"
        ? phase === "view"
          ? ["PageView", "ViewContent"]
          : ["Lead"]
        : c.provider === "tiktok"
          ? phase === "view"
            ? ["PageView", "ViewContent"]
            : ["SubmitForm"]
          : phase === "checkout"
            ? ["conversion"]
            : [];
    return names.map((name) => ({
      provider: c.provider,
      mode: c.mode,
      settings: c.settings,
      name,
      eventId: orderNumber ? leadEventId(orderNumber) : undefined,
    }));
  });
}
