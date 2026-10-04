import { expect, test } from "@playwright/test";
const password = "Test-storefront-password-2026!";
test("Published mobile COD checkout creates Kenya order and renders Ghana offer", async ({
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
  await customer.goto(
    `${publicUrl}?market=KE&utm_source=e2e&utm_campaign=serum-launch`,
  );
  await expect(
    customer.getByRole("heading", { name: "A little care, every day." }),
  ).toBeVisible();
  await expect(customer.locator(".public-price strong")).toHaveText(
    "KES 3,990.00",
  );
  await expect(
    customer.getByRole("img", { name: "Hair serum bottle" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      customer
        .getByRole("img", { name: "Hair serum bottle" })
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(
    customer.getByRole("combobox", { name: "Delivery market" }),
  ).toHaveValue("KE");
  await expect(customer.locator(".public-sticky")).toBeVisible();
  expect(
    await customer.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const phone = customer.getByRole("textbox", { name: "Phone number" });
  await expect(phone).toHaveAttribute("type", "tel");
  await expect(phone).toHaveAttribute("inputmode", "tel");
  await customer.getByLabel("Full name").fill("Jane Kenyan");
  await phone.fill("12345");
  await customer.getByLabel("County").fill("Nairobi");
  await customer.getByLabel("City / town").fill("Nairobi");
  await customer.getByLabel("Delivery address").fill("12 Garden Road, Nairobi");
  await customer
    .getByRole("combobox", { name: "Variant", exact: true })
    .selectOption({ label: "50 ml" });
  await customer.screenshot({
    path: "/tmp/africacod-checkpoint3-mobile-checkout.png",
    fullPage: true,
  });
  await customer.locator(".public-submit").click();
  await expect(
    customer.locator(".public-storefront").getByRole("alert"),
  ).toContainText("valid phone number");
  await phone.fill("0712345678");
  let submissions = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await customer.route("**/api/storefront/**/checkout", async (route) => {
    submissions++;
    await gate;
    await route.continue();
  });
  await customer.locator("#cod-checkout").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
    (form as HTMLFormElement).requestSubmit();
  });
  await expect(customer.locator(".public-submit")).toBeDisabled();
  await expect(customer.locator(".public-submit")).toHaveText("Placing order…");
  release();
  await expect(
    customer.getByRole("heading", { name: "Thank you for your order." }),
  ).toBeVisible();
  expect(submissions).toBe(1);
  const reference = (await customer
    .locator(".public-receipt strong")
    .textContent())!;
  await customer.screenshot({
    path: "/tmp/africacod-checkpoint3-mobile-success.png",
    fullPage: true,
  });
  await page.goto("/orders");
  const row = page.getByRole("row").filter({ hasText: reference });
  await expect(row).toContainText("Kenya");
  await expect(row).toContainText("Jane Kenyan");
  await expect(row).toContainText("KES 3,990.00");
  await row.getByRole("link", { name: reference }).click();
  await expect(page.getByRole("heading", { name: reference })).toBeVisible();
  await expect(page.getByText("50 ml · SKU: SERUM-50")).toBeVisible();
  await expect(
    page.getByText("12 Garden Road, Nairobi", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("serum-launch", { exact: true })).toBeVisible();
  await customer.goto(`${publicUrl}?market=GH`);
  await expect(customer.locator(".public-price strong")).toHaveText(
    "GHS 399.00",
  );
  await expect(customer.getByLabel("Region", { exact: true })).toBeVisible();
  await customer.goto(`${publicUrl}?market=RW`);
  await expect(
    customer.locator(".public-storefront").getByRole("alert"),
  ).toContainText("unavailable");
  await expect(customer.locator(".public-submit")).toHaveCount(0);
  await customer.goto(publicUrl);
  await expect(customer.locator(".public-price")).toHaveCount(0);
  await customerContext.close();
});
