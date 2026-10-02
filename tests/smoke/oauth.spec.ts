import { test, expect } from "@playwright/test";
test("Google Connect follows a CSP-allowed, PKCE-protected redirect without exposing deployment secrets", async ({
  page,
  context,
}) => {
  const suffix = crypto.randomUUID();
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("OAuth smoke merchant");
  await page.getByLabel("Email address").fill(`${suffix}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Smoke-merchant-password-2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel("Organization name").fill("OAuth smoke organization");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/stores$/);
  await page.goto("/stores/new");
  await page.getByLabel("Store name").fill("OAuth smoke Store");
  await page.getByLabel("Store address").fill(`oauth-${suffix}`);
  await page.getByRole("button", { name: "Create store", exact: true }).click();
  await expect(page).toHaveURL(/stores\/[a-f0-9-]+$/);
  const storeId = page.url().split("/").at(-1);
  await page.goto(`/apps/google-sheets?storeId=${storeId}`);
  // CDP interception covers redirect hops; Playwright route handlers only see
  // the first request in a redirect chain. Never contact Google in this fixture.
  const protocol = await context.newCDPSession(page);
  protocol.on("Fetch.requestPaused", async ({ requestId }) => {
    await protocol.send("Fetch.fulfillRequest", {
      requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "text/html" }],
      body: Buffer.from(
        "<main><h1>Intercepted Google authorization</h1></main>",
      ).toString("base64"),
    });
  });
  await protocol.send("Fetch.enable", {
    patterns: [
      { urlPattern: "https://accounts.google.com/*", requestStage: "Request" },
    ],
  });
  await page
    .getByRole("button", { name: "Connect Google", exact: true })
    .click();
  await expect(page).toHaveURL(/^https:\/\/accounts.google.com\/o\/oauth2/);
  await expect(
    page.getByRole("heading", { name: "Intercepted Google authorization" }),
  ).toBeVisible();
  const url = new URL(page.url());
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(url.searchParams.has("client_secret")).toBe(false);
  expect(url.searchParams.get("access_type")).toBe("offline");
  const cookies = await context.cookies(
    "http://localhost:3100/api/integrations/google/callback",
  );
  const state = cookies.find((c) => c.name === "ac_google_state");
  expect(state?.httpOnly).toBe(true);
  expect(state?.sameSite).toBe("Lax");
  expect(state?.value).toBe(url.searchParams.get("state"));
});
