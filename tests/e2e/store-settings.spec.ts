import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
const password = "Test-storefront-password-2026!";
test("Store settings Draft → private Preview → Publish → custom COD snapshot and real dashboard", async ({
  page,
  browser,
}) => {
  test.setTimeout(420000);
  page.setDefaultTimeout(20000);
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `storefront-${suffix}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Catalog Merchant");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/stores\/new$/);
  await page.goto("/stores/new");
  await expect(
    page.getByRole("heading", { name: "Create your first Store" }),
  ).toBeVisible();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel("Store name").fill("Glow Beauty");
  await page.getByLabel("Store address").fill(`catalog-${suffix}`);
  await page.getByRole("button", { name: "Create store", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/[0-9a-f-]+$/);
  const storeUrl = page.url();
  const storeId = storeUrl.split("/").at(-1)!;
  await expect(
    page.getByText("Draft / Not Published", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText("1 of 6 completed")).toBeVisible();
  await expect(page.getByLabel("Store URL")).toHaveValue(
    new RegExp(`/s/catalog-${suffix}$`),
  );
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
  const publicUrl = (await page
    .getByRole("link", { name: "Open public page" })
    .getAttribute("href"))!;
  const storeSlug = publicUrl.split("/")[2];
  await page.goto(`/pages/new?storeId=${storeId}`);
  await page.getByLabel("Title", { exact: true }).fill("About Glow Beauty");
  await page
    .getByLabel("Content", { exact: true })
    .fill("Our Store accepts cash on delivery.");
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Publish page", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Page published");
  const settingsUrl = `/stores/${storeId}/settings`;
  await page.goto(settingsUrl);
  await page.getByLabel("Brand Color HEX").fill("#265a8f");
  await page.getByRole("combobox", { name: /^Font/ }).selectOption("inter");
  await page.getByLabel("Enable Announcement", { exact: true }).check();
  await page
    .getByLabel("Announcement Text", { exact: true })
    .fill("Nairobi delivery information");
  await page.getByLabel("Show Hero Section", { exact: true }).check();
  await page
    .getByLabel("Hero Title", { exact: true })
    .fill("Care for your everyday routine");
  await page
    .getByLabel("Hero Subtitle", { exact: true })
    .fill("Choose products available in your delivery market.");
  await page.getByLabel("Show Featured Products", { exact: true }).check();
  await page
    .getByLabel("Featured Section Title", { exact: true })
    .fill("Our selection");
  await page
    .getByRole("combobox", { name: /^Selection mode/ })
    .selectOption("manual");
  await page
    .getByRole("checkbox", { name: "Hair Growth Serum", exact: true })
    .check();
  await page.getByRole("tab", { name: "Product Page", exact: true }).click();
  await page
    .getByRole("combobox", { name: /^Order Form Style/ })
    .selectOption("popup");
  await page.getByLabel("Sticky Order CTA", { exact: true }).check();
  await page.getByLabel("Quantity Selector", { exact: true }).check();
  await page
    .getByLabel("Order Button Label", { exact: true })
    .fill("Order this serum");
  await page.getByRole("button", { name: "+ Add Field", exact: true }).click();
  await page
    .getByLabel("Field label", { exact: true })
    .fill("Delivery landmark");
  await page.getByLabel("Field required", { exact: true }).check();
  await page.getByRole("tab", { name: "Navigation", exact: true }).click();
  await page
    .getByRole("button", { name: "Add header link", exact: true })
    .click();
  await page.getByLabel("Link label", { exact: true }).fill("About");
  await page
    .getByRole("combobox", { name: /^Destination/ })
    .selectOption({ label: "About Glow Beauty" });
  await page
    .getByLabel("Instagram URL", { exact: true })
    .fill("https://www.instagram.com/glow-example");
  await page
    .getByRole("button", { name: "Add footer link", exact: true })
    .click();
  await page.getByLabel("Link label", { exact: true }).last().fill("Our story");
  await page
    .getByRole("combobox", { name: /^Destination/ })
    .last()
    .selectOption({ label: "About Glow Beauty" });
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  const customerContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  const customer = await customerContext.newPage();
  customer.setDefaultTimeout(20000);
  await customer.goto(`/s/${storeSlug}?market=KE`);
  // Next can stream a notFound boundary after sending HTTP headers. Verify the actual access boundary.
  await expect(
    customer.getByRole("heading", { name: "We couldn’t find that page." }),
  ).toBeVisible();
  await expect(customer.locator(".storefront-shell")).toHaveCount(0);
  await expect(
    customer.getByText("Nairobi delivery information", { exact: true }),
  ).toHaveCount(0);
  await page.goto(`/stores/${storeId}/preview?market=KE`);
  await expect(
    page.getByText("Private Draft preview", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Nairobi delivery information", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Care for your everyday routine",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Store market", { exact: true }).selectOption("GH");
  await expect(page.locator(".store-card-price strong").first()).toHaveText(
    "GHS 399.00",
  );
  await page.goto(`/stores/${storeId}/preview/p/hair-growth-serum?market=KE`);
  await page
    .getByRole("button", { name: "Order this serum", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Delivery landmark", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Order this serum", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Close order form", exact: true })
    .click();
  await page.goto(settingsUrl);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Store settings published",
  );
  const livePopup = page.waitForEvent("popup");
  await page.getByRole("link", { name: "View Store", exact: true }).click();
  const liveStore = await livePopup;
  await expect(liveStore).toHaveURL(new RegExp(`/s/${storeSlug}`));
  await liveStore.close();
  await customer.reload();
  await expect(
    customer.getByText("Nairobi delivery information", { exact: true }),
  ).toBeVisible();
  await expect(
    customer.getByRole("heading", { name: "Our selection", exact: true }),
  ).toBeVisible();
  await expect(
    customer
      .getByRole("navigation", { name: "Store navigation", exact: true })
      .getByRole("link", { name: "About", exact: true }),
  ).toBeVisible();
  await expect(
    customer
      .getByRole("navigation", { name: "Footer navigation", exact: true })
      .getByRole("link", { name: "Our story", exact: true }),
  ).toBeVisible();
  await expect(
    customer.getByRole("link", { name: "Instagram", exact: true }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  // Real visitor capture, not a dashboard fixture or fabricated metric.
  const observation = await customer.request.post(
    `/api/storefront/${storeSlug}/events`,
    {
      headers: { Origin: "http://localhost:3100" },
      data: { eventId: crypto.randomUUID(), type: "store_view", market: "KE" },
    },
  );
  expect(observation.ok()).toBeTruthy();
  async function noOverflow(target: typeof page) {
    expect(
      await target.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  for (const width of [375, 768, 1280]) {
    await customer.setViewportSize({ width, height: 900 });
    await customer.goto(`/s/${storeSlug}?market=KE`);
    await noOverflow(customer);
    await customer.goto(`${publicUrl}?market=KE`);
    await noOverflow(customer);
    await expect(customer.locator(".public-price strong")).toHaveText(
      "KES 3,990.00",
    );
    await customer
      .getByRole("button", { name: "Order this serum", exact: true })
      .first()
      .click();
    await expect(customer.getByRole("dialog")).toBeVisible();
    await noOverflow(customer);
    if (width === 375)
      await customer.screenshot({
        path: "/tmp/africacod-cp91-mobile-checkout.png",
        fullPage: true,
      });
    expect(
      (
        await new AxeBuilder({ page: customer })
          .include(".storefront-shell")
          .analyze()
      ).violations,
    ).toEqual([]);
    await customer.getByRole("dialog").press("Escape");
    await expect(customer.getByRole("dialog")).not.toBeVisible();
    for (const route of [
      "/dashboard",
      settingsUrl,
      `/stores/${storeId}/preview?market=KE`,
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await noOverflow(page);
      if (width === 375)
        await page.screenshot({
          path: `/tmp/africacod-cp91-${route === "/dashboard" ? "dashboard" : route === settingsUrl ? "settings" : "preview"}-375.png`,
          fullPage: true,
        });
      expect(
        (await new AxeBuilder({ page }).include("main").analyze()).violations,
      ).toEqual([]);
    }
  }
  await customer.setViewportSize({ width: 375, height: 812 });
  await customer.goto(`${publicUrl}?market=KE`);
  await customer
    .getByRole("button", { name: "Order this serum", exact: true })
    .first()
    .click();
  const form = customer.getByRole("dialog");
  await form.getByLabel("Full name", { exact: true }).fill("Jane Kenyan");
  await form.getByLabel("Phone number", { exact: true }).fill("0712345678");
  await form.getByLabel("County", { exact: true }).fill("Nairobi");
  await form.getByLabel("City / town", { exact: true }).fill("Nairobi");
  await form
    .getByLabel("Delivery address", { exact: true })
    .fill("12 Garden Road");
  await form
    .getByLabel("Delivery landmark", { exact: true })
    .fill("Blue gate near the library");
  await form
    .getByRole("button", { name: "Order this serum", exact: true })
    .click();
  await expect(
    customer.getByRole("heading", {
      name: "Thank you for your order.",
      exact: true,
    }),
  ).toBeVisible();
  const reference = (await customer
    .locator(".public-receipt strong")
    .first()
    .textContent())!;
  await page.goto(`/orders?search=${reference}`);
  await page.getByRole("link", { name: reference, exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Additional order details",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Delivery landmark", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Blue gate near the library", { exact: true }),
  ).toBeVisible();
  await page.goto(`/dashboard?range=today&storeId=${storeId}`);
  await expect(
    page
      .getByRole("region", { name: "Period metrics" })
      .locator(".stat-card")
      .filter({ hasText: "Total Orders" })
      .locator("strong"),
  ).toHaveText("1");
  await expect(
    page.getByRole("heading", { name: "COD Performance Funnel", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Performance by Product", exact: true }),
  ).toBeVisible();
  await customer.goto(`/stores/${storeId}/preview?market=KE`);
  await expect(customer).toHaveURL(/\/sign-in$/);
  await customerContext.close();
});
