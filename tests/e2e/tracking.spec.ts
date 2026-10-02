import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
let worker: ChildProcess;
test.beforeAll(() => {
  worker = spawn(
    process.execPath,
    ["--import", "tsx", "apps/worker/src/index.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TRACKING_TEST_MODE: "1",
        INTEGRATION_CREDENTIALS_KEY:
          "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        PROVIDER_TEST_MODE: "1",
        PROVIDER_CREDENTIALS_KEY:
          "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      },
      stdio: "ignore",
    },
  );
});
test.afterAll(async () => {
  if (worker && worker.exitCode === null) {
    worker.kill("SIGTERM");
    await Promise.race([
      once(worker, "exit"),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (worker.exitCode === null) worker.kill("SIGKILL");
  }
});

const password = "Test-storefront-password-2026!";
test("Tracking exports and lifecycle analytics preserve Kenya and Ghana COD truth", async ({
  page,
  browser,
}) => {
  test.setTimeout(300000);
  page.setDefaultTimeout(20000);
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `storefront-${suffix}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Catalog Merchant");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Organization name").fill(`Catalog ${suffix}`);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/stores$/);
  await page.goto("/stores/new");
  await page.getByLabel("Store name").fill("Glow Beauty");
  await page.getByLabel("Store address").fill(`catalog-${suffix}`);
  await page.getByRole("button", { name: "Create store", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/[0-9a-f-]+$/);
  const storeUrl = page.url();
  const storeId = storeUrl.split("/").at(-1)!;
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/products/new?storeId=${storeId}`);
  await expect(
    page.getByText("No markets configured for this store."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add a market", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No markets yet" }),
  ).toBeVisible();
  for (const country of ["Kenya", "Ghana"]) {
    await page
      .getByRole("button", { name: "Add Market", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Search countries").fill(country);
    await dialog.getByText(country, { exact: true }).click();
    await dialog.getByRole("button", { name: "Add selected market" }).click();
    await expect(dialog).not.toBeVisible();
  }
  await page.goto(`/categories?storeId=${storeId}`);
  await page
    .getByRole("link", { name: "Add Category", exact: true })
    .first()
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Beauty");
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(page).toHaveURL(/\/categories\/[0-9a-f-]+$/);
  await page.goto(`/categories?storeId=${storeId}`);
  await page
    .getByRole("link", { name: "Add subcategory", exact: true })
    .first()
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Hair");
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(page).toHaveURL(/\/categories\/[0-9a-f-]+$/);
  await expect(page.getByLabel("Parent category")).not.toHaveValue("");
  await page.goto(`/products/new?storeId=${storeId}`);
  await page.getByLabel("Name", { exact: true }).fill("Hair Growth Serum");
  await page.getByLabel("SKU", { exact: true }).fill("SERUM-001");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Beauty" });
  await page
    .getByRole("combobox", { name: "Subcategory", exact: true })
    .selectOption({ label: "Hair" });
  await page
    .getByLabel("Short description")
    .fill("A daily serum for healthy-looking hair.");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Apply a small amount to your scalp each day.");
  await page.getByLabel("Product status").selectOption("active");
  await page
    .getByRole("button", { name: "Create product", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);
  const productUrl = page.url();
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("Product image", { exact: true })
    .setInputFiles({ name: "serum.png", mimeType: "image/png", buffer: bytes });
  await page
    .getByLabel("Image description", { exact: true })
    .fill("Hair serum bottle");
  await page.getByRole("button", { name: "Upload image", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Image uploaded." }),
  ).toBeVisible();
  const image = page.getByRole("img", { name: "Hair serum bottle" });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const variant = page.getByRole("form", { name: "Add variant", exact: true });
  await variant.getByLabel("Variant name").fill("50 ml");
  await variant.getByLabel("Variant SKU").fill("SERUM-50");
  await variant
    .getByRole("button", { name: "Add variant", exact: true })
    .click();
  await expect(page.getByRole("form", { name: "Variant 50 ml" })).toBeVisible();
  for (const [country, price, compareAt, cost] of [
    ["Kenya", "3990", "4990", "1200"],
    ["Ghana", "399", "499", "120"],
  ]) {
    await page.locator("summary").filter({ hasText: country }).click();
    const offer = page.getByRole("form", {
      name: `${country} offer`,
      exact: true,
    });
    await offer.getByLabel(/^Price \(/).fill(price);
    await offer.getByLabel(/^Compare-at price/).fill(compareAt);
    await offer.getByLabel(/^Cost/).fill(cost);
    await offer
      .getByRole("button", { name: `Save ${country} offer`, exact: true })
      .click();
    await expect(offer.getByRole("status")).toContainText("Offer saved.");
  }

  await page.reload();
  await page
    .getByLabel("Headline", { exact: true })
    .fill("A little care, every day.");
  await page
    .getByRole("textbox", { name: /^Subtitle/ })
    .fill("Meet your daily hair routine.");
  await page
    .getByLabel("Benefit bullets")
    .fill("Easy daily application\n50 ml bottle");
  await page
    .getByRole("checkbox", { name: "Hair serum bottle", exact: true })
    .check();
  await page.getByRole("button", { name: "Save storefront draft" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Draft saved." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Preview draft" }).click();
  await expect(
    page.getByRole("heading", { name: "A little care, every day." }),
  ).toBeVisible();
  await expect(
    page.getByText("Draft preview · Checkout is disabled"),
  ).toBeVisible();
  await page.goto(productUrl);
  await page
    .getByRole("button", { name: "Publish storefront", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Storefront published." }),
  ).toBeVisible();
  const publicUrl = (await page
    .getByRole("link", { name: "Open public page" })
    .getAttribute("href"))!;
  const customerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  customerContext.setDefaultTimeout(20000);
  const customer = await customerContext.newPage();
  async function submitOrder(name: string, market = "KE") {
    await customer.goto(
      `${publicUrl}?market=${market}&utm_source=e2e&utm_campaign=launch`,
    );
    await customer.getByLabel("Full name").fill(name);
    await customer
      .getByRole("textbox", { name: "Phone number" })
      .fill(market === "GH" ? "0241234567" : "0712345678");
    if (market === "KE") await customer.getByLabel("County").fill("Nairobi");
    else
      await customer
        .getByLabel("Region", { exact: true })
        .fill("Greater Accra");
    await customer.getByLabel("City / town").fill("Nairobi");
    await customer
      .getByLabel("Delivery address")
      .fill("24 Garden Road, Nairobi");
    await customer.locator(".public-submit").click();
    await expect(
      customer.getByRole("heading", { name: "Thank you for your order." }),
    ).toBeVisible();
    return (await customer.locator(".public-receipt strong").textContent())!;
  }
  async function openOrder(reference: string) {
    await page.goto("/orders");
    await page
      .getByRole("row")
      .filter({ hasText: reference })
      .getByRole("link", { name: reference, exact: true })
      .click();
    await expect(page.locator(".page-heading .badge")).toHaveText("new");
    return page.url();
  }
  async function prepareFulfillment() {
    await page
      .getByRole("button", { name: "Confirm order", exact: true })
      .click();
    await expect(page.locator(".page-heading .badge")).toHaveText("confirmed");
    await page
      .getByRole("button", { name: "Create fulfillment", exact: true })
      .click();
    await expect(page.getByTestId("fulfillment-state")).toHaveText("ready");
  }
  async function waitShipment(status: string) {
    await expect(page.getByTestId("shipment-state")).toHaveText(status);
  }

  for (const provider of ["meta", "google-sheets"]) {
    await page.goto(`/apps/${provider}?storeId=${storeId}`);
    await page.getByLabel("Enable integration for this store").check();
    if (provider === "meta") {
      await page.getByLabel("Pixel ID", { exact: true }).fill("123456789");
      await page
        .getByLabel("CAPI access token", { exact: true })
        .fill("mock-capi-secret");
      await page
        .getByLabel("Purchase event", { exact: true })
        .selectOption("delivered");
    } else
      await page
        .getByLabel("Export destination", { exact: true })
        .fill("Mock order spreadsheet");
    await page
      .getByRole("button", { name: "Save tracking settings", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Settings saved.");
  }
  const kenyaOrder = await submitOrder("Kenya Tracking Customer");
  const browserEvents = await customer.evaluate(
    () =>
      (
        window as Window & {
          __commerceTracking?: { name: string; eventId?: string }[];
        }
      ).__commerceTracking ?? [],
  );
  expect(browserEvents.map((e) => e.name)).toEqual([
    "PageView",
    "ViewContent",
    "Lead",
  ]);
  expect(browserEvents.find((e) => e.name === "Lead")?.eventId).toBe(
    `checkout:${kenyaOrder}`,
  );
  const kenyaUrl = await openOrder(kenyaOrder);
  await prepareFulfillment();
  await page.getByLabel("Tracking number (optional)").fill("TRACK-KE");
  await page
    .getByRole("button", { name: "Create manual shipment", exact: true })
    .click();
  await waitShipment("created");
  // Change the current offer after checkout; analytics and Purchase must retain the original order total.
  await page.goto(productUrl);
  const offer = page.getByRole("form", { name: "Kenya offer", exact: true });
  await offer.getByLabel(/^Price \(/).fill("4490");
  await offer
    .getByRole("button", { name: "Save Kenya offer", exact: true })
    .click();
  await expect(offer.getByRole("status")).toContainText("Offer saved.");
  await page.goto(kenyaUrl);
  for (const status of ["shipped", "out_for_delivery", "delivered"]) {
    await page
      .getByRole("button", {
        name: `Mark ${status.replaceAll("_", " ")}`,
        exact: true,
      })
      .click();
    await waitShipment(status);
  }
  await expect
    .poll(
      async () => {
        await page.goto(`/apps/meta?storeId=${storeId}`);
        return (
          await page
            .getByRole("row")
            .filter({ hasText: "shipment_delivered" })
            .allTextContents()
        ).join("");
      },
      { timeout: 30000 },
    )
    .toContain("Purchase · 3990 · KES");
  await expect(page.getByTestId("tracking-status")).toContainText(
    "Connected (test adapter)",
  );
  await expect(
    page.getByLabel("CAPI access token", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("row").filter({ hasText: "checkout_submitted" }),
  ).toContainText(`checkout:${kenyaOrder}`);
  await expect
    .poll(
      async () => {
        await page.goto(`/apps/google-sheets?storeId=${storeId}`);
        return (await page.getByTestId("sheets-rows").allTextContents()).join(
          "",
        );
      },
      { timeout: 30000 },
    )
    .toContain("delivered");
  await expect(
    page.getByTestId("sheets-rows").getByRole("article"),
  ).toHaveCount(1);
  await expect(page.getByTestId("sheets-rows")).not.toContainText("Cost");
  await page.goto("/analytics?range=today");
  const markets = page.getByTestId("analytics-markets");
  await expect(
    markets.getByRole("row").filter({ hasText: "Kenya" }),
  ).toContainText("3,990.00");
  await page.screenshot({
    path: "test-results/checkpoint-7-analytics.png",
    fullPage: true,
  });
  const ghanaOrder = await submitOrder("Ghana Tracking Customer", "GH");
  await openOrder(ghanaOrder);
  await prepareFulfillment();
  await page
    .getByRole("button", { name: "Create manual shipment", exact: true })
    .click();
  await waitShipment("created");
  for (const status of ["shipped", "out_for_delivery", "delivered"]) {
    await page
      .getByRole("button", {
        name: `Mark ${status.replaceAll("_", " ")}`,
        exact: true,
      })
      .click();
    await waitShipment(status);
  }
  await page.goto("/analytics?range=today");
  const ghana = page
    .getByTestId("analytics-markets")
    .getByRole("row")
    .filter({ hasText: "Ghana" });
  await expect(ghana).toContainText("399.00");
  await expect(ghana).toContainText("100.0%");
  await expect(
    page
      .getByTestId("analytics-markets")
      .getByRole("row")
      .filter({ hasText: "Kenya" }),
  ).toContainText("3,990.00");
  await expect
    .poll(
      async () => {
        await page.goto(`/apps/google-sheets?storeId=${storeId}`);
        return (
          await page
            .getByTestId("sheets-rows")
            .getByRole("article")
            .allTextContents()
        ).filter((t) => t.includes("delivered")).length;
      },
      { timeout: 30000 },
    )
    .toBe(2);
  await expect(
    page.getByTestId("sheets-rows").getByRole("article"),
  ).toHaveCount(2);
  await customerContext.close();
});
