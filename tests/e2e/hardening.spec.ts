import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("Auth accessibility, safe health endpoints and security headers", async ({
  page,
  request,
}) => {
  const response = await page.goto("/sign-in");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(response?.headers()["content-security-policy"]).toContain(
    "connect.facebook.net",
  );
  expect(response?.headers()["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  for (const path of ["live", "ready"]) {
    const health = await request.get(`/api/health/${path}`);
    expect(health.status()).toBe(200);
    expect(health.headers()["cache-control"]).toBe("no-store");
    expect(JSON.stringify(await health.json())).not.toMatch(
      /postgres|password|localhost|DATABASE_URL/,
    );
  }
  for (const [host, path] of [
    ["connect.facebook.net", "/en_US/fbevents.js"],
    ["analytics.tiktok.com", "/i18n/pixel/events.js"],
    ["www.googletagmanager.com", "/gtag/js?id=AW-123"],
  ]) {
    const url = `https://${host}${path}`;
    await page.route(url, (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "window.__cspFixtureLoaded = true;",
      }),
    );
    await page.evaluate(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = url;
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Tracking script blocked by CSP"));
          document.head.append(script);
        }),
      url,
    );
  }
  expect(response?.headers()["content-security-policy"]).toContain(
    "form-action 'self' https://accounts.google.com",
  );
  const unauthorized = await request.get(`/api/media/${crypto.randomUUID()}`);
  expect(unauthorized.status()).toBe(401);
  const oversize = await request.post("/api/storefront/unknown/events", {
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3100",
    },
    data: "x".repeat(2000),
  });
  expect(oversize.status()).toBe(413);
  // A separate staging proxy identity keeps this saturation check independent
  // of merchant lifecycle traffic. Unknown storefront requests create no Orders.
  for (let attempt = 0; attempt < 31; attempt++) {
    const limited = await request.post(
      "/api/storefront/unknown/unknown/checkout",
      {
        headers: {
          Origin: "http://localhost:3100",
          "x-real-ip": "192.0.2.55",
          "Idempotency-Key": crypto.randomUUID(),
        },
        data: {},
      },
    );
    if (attempt < 30) expect([400, 404]).toContain(limited.status());
    else {
      expect(limited.status()).toBe(429);
      expect(limited.headers()["retry-after"]).toBe("60");
      expect(limited.headers()["cache-control"]).toBe("no-store");
      expect(limited.headers()["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
    }
  }
});
