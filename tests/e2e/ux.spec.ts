import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
const password = "Test-storefront-password-2026!";
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
test("coherent merchant navigation and mobile customer checkout", async ({
  page,
  browser,
}) => {
  test.setTimeout(300000);
  page.setDefaultTimeout(20000);
  const clientErrors: string[] = [];
  page.on("pageerror", (error) => clientErrors.push(error.message));
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
  await expect(page).toHaveURL(/\/stores\/new$/);
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
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGUlEQVQokWOomLWHJMQwqmHWaChVDNekAQBYfc4QCt8PtQAAAABJRU5ErkJggg==",
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
  const productLocation = page.url();
  await page.goto(`/stores/${storeId}/settings`);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Store settings published" }),
  ).toBeVisible();
  await page.goto(productLocation);
  const publicUrl = (await page
    .getByRole("link", { name: "Open public page" })
    .getAttribute("href"))!;

  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  const customer = await context.newPage();
  customer.setDefaultTimeout(20000);
  const observationResponses: number[] = [];
  customer.on("pageerror", (error) => clientErrors.push(error.message));
  customer.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      /\/(events|view)$/.test(response.url())
    )
      observationResponses.push(response.status());
  });
  const observationRequests: { type: string }[] = [];
  customer.on("request", (request) => {
    if (request.url().endsWith("/events") && request.method() === "POST")
      observationRequests.push(request.postDataJSON());
    if (request.url().endsWith("/view") && request.method() === "POST")
      observationRequests.push({ type: "product_view" });
  });
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/dashboard",
      "/products",
      "/categories",
      storeUrl,
      productUrl,
      "/orders",
      "/orders/confirmation",
      "/fulfillment",
      "/analytics",
      "/apps",
      "/pages",
      "/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();
      await noOverflow(page);
      if (route === "/analytics" && width === 375) {
        const region = page.getByRole("region", { name: "Markets data table" });
        await region.focus();
        await expect(region).toBeFocused();
        const before = await region.evaluate((el) => el.scrollLeft);
        await page.keyboard.press("ArrowRight");
        await expect
          .poll(() => region.evaluate((el) => el.scrollLeft))
          .toBeGreaterThan(before);
      }

      if (width === 1280) {
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect.soft(result.violations, route).toEqual([]);
      }
    }
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    if (width === 375) {
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Close menu", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Open menu", exact: true }),
      ).toBeFocused();
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
    }
    await nav.getByRole("link", { name: "Confirmation", exact: true }).click();
    await expect(page).toHaveURL(/\/orders\/confirmation$/);
    if (width === 375)
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
    await expect(
      nav.getByRole("link", { name: "Confirmation", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: "Orders", exact: true }),
    ).not.toHaveAttribute("aria-current", "page");
    if (width === 375) await page.keyboard.press("Escape");
  }
  await customer.goto(`/s/catalog-${suffix}?market=KE`);
  await expect(customer.getByText("Kenya · KES")).toBeVisible();
  await noOverflow(customer);
  await customer.getByRole("link", { name: /Hair Growth Serum/ }).click();
  await expect.poll(() => customer.url()).toContain(publicUrl);
  await expect(
    customer.getByRole("heading", { name: "A little care, every day." }),
  ).toBeVisible();
  await expect(customer.locator(".public-price")).toContainText("3,990");
  await customer.getByLabel("Full name").fill("Jane Kenyan");
  await customer.getByLabel("Phone number", { exact: true }).fill("0712345678");
  await customer.getByLabel("County", { exact: true }).fill("Nairobi");
  await customer.getByLabel("City / town", { exact: true }).fill("Nairobi");
  await customer
    .getByLabel("Delivery address", { exact: true })
    .fill("12 Garden Road");
  const checkoutAccessibility = await new AxeBuilder({ page: customer })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect.soft(checkoutAccessibility.violations, "Public checkout").toEqual([]);
  await customer
    .locator("#cod-checkout")
    .getByRole("button", { name: "Order with cash on delivery", exact: true })
    .click();
  await expect(
    customer.getByRole("heading", { name: "Thank you for your order." }),
  ).toBeFocused();
  await noOverflow(customer);
  await expect
    .poll(() => observationRequests.map((r) => r.type))
    .toEqual(
      expect.arrayContaining([
        "store_view",
        "product_view",
        "checkout_started",
      ]),
    );
  await expect.poll(() => observationResponses.length).toBe(3);
  expect(observationResponses).toEqual([200, 200, 200]);
  expect(
    observationRequests.filter((r) => r.type === "checkout_started"),
  ).toHaveLength(1);
  await page.goto("/orders");
  await page
    .getByRole("link", { name: "Open order", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("order-commercial-status")).toHaveText("new");
  const orderAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect.soft(orderAccessibility.violations, "Order detail").toEqual([]);
  await expect(
    page.getByRole("heading", { name: "Customer & delivery snapshot" }),
  ).toBeVisible();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
  }
  await page.screenshot({
    path: "test-results/checkpoint-8-order-detail.png",
    fullPage: true,
  });
  await customer.screenshot({
    path: "test-results/checkpoint-8-mobile-success.png",
    fullPage: true,
  });
  const badOrigin = await customer.request.post(
    `/api/storefront/catalog-${suffix}/events`,
    {
      headers: { Origin: "https://unrelated.example" },
      data: { eventId: crypto.randomUUID(), type: "store_view" },
    },
  );
  expect(badOrigin.status()).toBe(403);
  const dntContext = await browser.newContext();
  await dntContext.addInitScript(() =>
    Object.defineProperty(navigator, "doNotTrack", { value: "1" }),
  );
  const dntPage = await dntContext.newPage();
  const dntRequests: string[] = [];
  dntPage.on("request", (request) => {
    if (request.method() === "POST" && /\/(view|events)$/.test(request.url()))
      dntRequests.push(request.url());
  });
  await dntPage.goto(`${publicUrl}?market=KE`);
  await dntPage.getByLabel("Full name").fill("DNT Customer");
  await dntPage.getByLabel("Phone number", { exact: true }).fill("0712345678");
  expect(dntRequests).toHaveLength(0);
  await dntContext.close();
  expect(clientErrors).toEqual([]);
  await context.close();
});
