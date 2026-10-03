import { it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  headers: vi.fn(),
  runtime: vi.fn(),
  log: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@africacod/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@africacod/domain", () => ({
  AbuseService: class {
    consume = mocks.consume;
  },
  abuseKey: (secret: string, scope: string, identity: string) =>
    createHmac("sha256", secret).update(`${scope}:${identity}`).digest("hex"),
}));
vi.mock("@africacod/shared", () => ({
  runtimeEnvironment: mocks.runtime,
  logEvent: mocks.log,
}));
import { withRateLimit, enforceActionRateLimit } from "./rate-limit";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.runtime.mockReturnValue({
    APP_ENV: "production",
    CLIENT_IP_HEADER: "x-real-ip",
    RATE_LIMIT_KEY: "rate-key",
  });
  mocks.consume.mockResolvedValue(true);
});
function request(idempotency = "checkout-key") {
  return new Request("https://beta.example/api/checkout", {
    method: "POST",
    headers: {
      "x-real-ip": "192.0.2.1",
      "x-request-id": "safe-request",
      "Idempotency-Key": idempotency,
    },
    body: "customer-payload",
  });
}
it("Node handler limiting preserves route context and the unread request body", async () => {
  const handler = withRateLimit(
    "checkout",
    async (req, context: { params: string }) =>
      Response.json({ body: await req.text(), params: context.params }),
  );
  expect(await (await handler(request(), { params: "store" })).json()).toEqual({
    body: "customer-payload",
    params: "store",
  });
  const firstKey = mocks.consume.mock.calls[0][0];
  await handler(request("different-business-key"), { params: "store" });
  expect(mocks.consume.mock.calls[1]).toEqual([firstKey, 30, 60]);
  expect(firstKey).not.toContain("192.0.2.1");
});
it("exhausted budgets return 429 without invoking business logic", async () => {
  mocks.consume.mockResolvedValue(false);
  const business = vi.fn();
  const response = await withRateLimit("auth", business)(request());
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  expect(response.headers.get("x-request-id")).toBe("safe-request");
  expect(business).not.toHaveBeenCalled();
});
it("missing trusted production identity or database failure fails closed without unsafe logs", async () => {
  const business = vi.fn();
  const route = withRateLimit("media", business);
  expect((await route(new Request("https://beta.example/media"))).status).toBe(
    503,
  );
  expect(mocks.consume).not.toHaveBeenCalled();
  mocks.consume.mockRejectedValue(new Error("postgres-password-and-address"));
  const response = await route(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("postgres");
  expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("password");
  expect(business).not.toHaveBeenCalled();
});
it("actions charge once per request, including re-render, but reused client IDs cannot bypass a new request", async () => {
  const actionHeaders = request().headers;
  actionHeaders.set("next-action", "action-id");
  mocks.headers.mockResolvedValue(actionHeaders);
  await Promise.all([enforceActionRateLimit(), enforceActionRateLimit()]);
  expect(mocks.consume).toHaveBeenCalledTimes(1);
  mocks.headers.mockResolvedValue(new Headers(actionHeaders));
  mocks.consume.mockResolvedValue(false);
  await expect(enforceActionRateLimit()).rejects.toThrow("Too many requests");
  expect(mocks.consume).toHaveBeenCalledTimes(2);
  mocks.headers.mockResolvedValue(new Headers());
  await enforceActionRateLimit();
  expect(mocks.consume).toHaveBeenCalledTimes(2);
});
