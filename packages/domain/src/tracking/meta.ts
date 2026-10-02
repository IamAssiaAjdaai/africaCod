export interface MetaTransport {
  send(
    pixelId: string,
    token: string,
    event: Record<string, unknown>,
  ): Promise<void>;
}
// Official CAPI /events contract; v25.0 is explicitly documented by Meta's using-the-api guide.
export class ProductionMetaTransport implements MetaTransport {
  constructor(private readonly request: typeof fetch = fetch) {}
  async send(pixelId: string, token: string, event: Record<string, unknown>) {
    if (!/^\d+$/.test(pixelId) || !token)
      throw new Error("Meta configuration incomplete.");
    if (
      typeof event.event_time !== "number" ||
      Date.now() / 1000 - event.event_time > 48 * 3600
    )
      throw new Error("Meta event expired.");
    const body = new URLSearchParams({
      access_token: token,
      data: JSON.stringify([event]),
    });
    const response = await this.request(
      `https://graph.facebook.com/v25.0/${pixelId}/events`,
      { method: "POST", body, signal: AbortSignal.timeout(8000) },
    );
    const result = await response.json();
    if (!response.ok || result.events_received !== 1)
      throw new Error("Meta did not acknowledge the event.");
  }
}
