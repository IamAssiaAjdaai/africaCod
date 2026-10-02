// Per-observation random ID only: no persistent visitor/session identifier or personal data.
export function captureVisitor(
  storeSlug: string,
  type: "store_view" | "product_view" | "checkout_started",
  market?: string,
  productSlug?: string,
) {
  if (navigator.doNotTrack === "1") return;
  void fetch(`/api/storefront/${storeSlug}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId: crypto.randomUUID(),
      type,
      market,
      productSlug,
    }),
  }).catch(() => {});
}
