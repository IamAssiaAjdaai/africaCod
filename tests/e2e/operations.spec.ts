import { expect, test } from "@playwright/test";
const password = "Test-storefront-password-2026!";
test("Manual lifecycle keeps Order confirmed through delivered and refused/returned shipments", async ({
  page,
  browser,
}) => {
  test.setTimeout(300000);
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
  const customerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const customer = await customerContext.newPage();
  async function submitOrder(name: string) {
    await customer.goto(`${publicUrl}?market=KE`);
    await customer.getByLabel("Full name").fill(name);
    await customer
      .getByRole("textbox", { name: "Phone number" })
      .fill("0712345678");
    await customer.getByLabel("County").fill("Nairobi");
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
    await expect(page.getByTestId("order-commercial-status")).toHaveText("new");
    return page.url();
  }
  async function fulfill() {
    await page
      .getByRole("button", { name: "Confirm order", exact: true })
      .click();
    await expect(page.getByTestId("order-commercial-status")).toHaveText(
      "confirmed",
    );
    await page
      .getByRole("button", { name: "Create fulfillment", exact: true })
      .click();
    await expect(page.getByTestId("fulfillment-state")).toHaveText("ready");
    await page
      .getByRole("button", { name: "Create manual shipment", exact: true })
      .click();
    await expect(page.getByTestId("fulfillment-state")).toHaveText("fulfilled");
    await expect(page.getByTestId("shipment-state")).toHaveText("created");
  }
  async function transition(label: string, status: string) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByTestId("shipment-state")).toHaveText(status);
    await expect(page.getByTestId("order-commercial-status")).toHaveText(
      "confirmed",
    );
  }
  const first = await submitOrder("Lifecycle Kenyan Customer");
  const firstUrl = await openOrder(first);
  await expect(page.getByTestId("confirmation-state")).toHaveText(
    "uncontacted",
  );
  await page.getByRole("button", { name: "No answer", exact: true }).click();
  await expect(page.getByTestId("confirmation-state")).toHaveText("attempted");
  await page
    .getByLabel("Callback date and time (UTC)")
    .fill(new Date(Date.now() - 3600000).toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Set callback", exact: true }).click();
  await expect(page.getByTestId("confirmation-state")).toHaveText(
    "callback_due",
  );
  await page.goto("/orders/callbacks");
  await expect(page.getByRole("row").filter({ hasText: first })).toContainText(
    "overdue",
  );
  await page.goto(firstUrl);
  await fulfill();
  await transition("Mark shipped", "shipped");
  await transition("Mark out for delivery", "out_for_delivery");
  await transition("Mark delivered", "delivered");
  await page.screenshot({
    path: "/tmp/africacod-checkpoint5-order.png",
    fullPage: true,
  });
  await page.goto("/dashboard");
  await expect(
    page.getByTestId("metric-delivered").locator("strong"),
  ).toHaveText("1");
  await expect(page.getByTestId("delivered-revenue")).toContainText(
    "KES 3,990.00",
  );
  // The old delivered order retains its snapshot after current offer edits.
  await page.goto(productUrl);
  const kenyaOffer = page.getByRole("form", {
    name: "Kenya offer",
    exact: true,
  });
  await kenyaOffer.getByLabel(/^Price \(/).fill("4490");
  await kenyaOffer
    .getByRole("button", { name: "Save Kenya offer", exact: true })
    .click();
  await expect(kenyaOffer.getByRole("status")).toContainText("Offer saved.");
  const second = await submitOrder("Returned Kenyan Customer");
  await openOrder(second);
  await fulfill();
  await transition("Mark shipped", "shipped");
  await transition("Mark out for delivery", "out_for_delivery");
  await transition("Mark refused", "refused");
  await transition("Mark returned", "returned");
  await page.goto("/fulfillment?fulfillment=fulfilled");
  await expect(page.getByRole("row").filter({ hasText: second })).toContainText(
    "returned",
  );
  await page.goto("/dashboard");
  await expect(
    page.getByTestId("metric-delivered").locator("strong"),
  ).toHaveText("1");
  await expect(
    page.getByTestId("metric-returned").locator("strong"),
  ).toHaveText("1");
  await expect(page.getByTestId("delivered-revenue")).toContainText(
    "KES 3,990.00",
  );
  await expect(page.getByTestId("delivered-revenue")).not.toContainText(
    "4,490",
  );
  await customerContext.close();
});
