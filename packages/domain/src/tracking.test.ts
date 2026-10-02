import { describe, it, expect, vi } from "vitest";
import { browserEvents, metaEventName } from "./tracking/policy";
import { ProductionMetaTransport } from "./tracking/meta";
import { analyticsRange } from "./analytics";
describe("COD provider policy and verified adapter boundary", () => {
  it("never maps submitted, created, confirmed, shipped or returned to Purchase", () => {
    for (const event of [
      "order_created",
      "order_confirmed",
      "shipment_created",
      "shipment_shipped",
      "shipment_out_for_delivery",
      "shipment_refused",
      "shipment_returned",
    ])
      expect(metaEventName(event, "delivered")).toBeNull();
    expect(metaEventName("checkout_submitted", "delivered")).toBe("Lead");
    expect(metaEventName("shipment_delivered", "disabled")).toBeNull();
    expect(metaEventName("shipment_delivered", "delivered")).toBe("Purchase");
  });
  it("browser has no Purchase or revenue value and no disabled connections", () => {
    expect(browserEvents([], "view")).toEqual([]);
    const c = { provider: "meta" as const, mode: "mock", settings: {} };
    expect(browserEvents([c], "view").map((e) => e.name)).toEqual([
      "PageView",
      "ViewContent",
    ]);
    expect(browserEvents([c], "checkout", "ORD-1")[0]).toMatchObject({
      name: "Lead",
      eventId: "checkout:ORD-1",
    });
    expect(browserEvents([{ ...c, mode: "blocked" }], "view")).toEqual([]);
    expect(
      browserEvents(
        [{ provider: "tiktok", mode: "browser", settings: {} }],
        "checkout",
        "ORD-1",
      )[0].name,
    ).toBe("SubmitForm");
  });
  it("production Meta follows the official edge and body without exposing tokens in URLs", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ events_received: 1 }), { status: 200 }),
      );
    const adapter = new ProductionMetaTransport(request),
      event = {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: "one",
        user_data: { ph: ["hashed"] },
      };
    await adapter.send("123456", "private", event);
    expect(request.mock.calls[0][0]).toBe(
      "https://graph.facebook.com/v25.0/123456/events",
    );
    const body = request.mock.calls[0][1]!.body as URLSearchParams;
    expect(body.get("data")).toBe(JSON.stringify([event]));
    expect(body.get("access_token")).toBe("private");
    request.mockResolvedValue(new Response("{}", { status: 400 }));
    await expect(adapter.send("123456", "private", event)).rejects.toThrow(
      "acknowledge",
    );
  });
  it("uses UTC inclusive day cohorts and rejects invalid custom ranges", () => {
    const now = new Date("2026-10-02T23:30:00Z");
    expect(analyticsRange({ range: "today" }, now)).toEqual({
      from: new Date("2026-10-02"),
      to: new Date("2026-10-03"),
    });
    expect(analyticsRange({ range: "yesterday" }, now).to.toISOString()).toBe(
      "2026-10-02T00:00:00.000Z",
    );
    expect(() =>
      analyticsRange(
        { range: "custom", from: "2026-10-03", to: "2026-10-01" },
        now,
      ),
    ).toThrow();
  });
});
