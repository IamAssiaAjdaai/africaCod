import { expect, test } from "@playwright/test";
const password = "Test-store-cms-password-2026!";
test("Storefront CMS navigation, branding, Apps discovery and COD remain market-aware", async ({
  page,
  browser,
}) => {
  test.setTimeout(300000);
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `cms-${suffix}@example.com`;
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

  await page.goto(`${storeUrl}/settings`);
  await page
    .getByLabel("Tagline", { exact: true })
    .fill("Everyday care, delivered to your door.");
  await page.getByLabel("Show Hero Section", { exact: true }).check();
  await page
    .getByLabel("Hero Title", { exact: true })
    .fill("Everyday care, delivered to your door.");
  await page
    .getByLabel("Contact email", { exact: true })
    .fill("hello@glow.example");
  await page
    .getByLabel("Light Mode logo", { exact: true })
    .setInputFiles({ name: "glow.png", mimeType: "image/png", buffer: bytes });
  await expect(
    page.getByRole("button", { name: "Save Draft", exact: true }),
  ).toBeEnabled();
  await expect(page.getByAltText("Light Mode logo")).toBeVisible();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Store settings published",
  );
  await page.goto(`/pages/new?storeId=${storeId}`);
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("About Glow Beauty");
  const content = page.getByRole("textbox", { name: "Content", exact: true });
  await content.fill("Our story");
  await content.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "H2", exact: true }).click();
  await expect(content).toHaveValue("## Our story");
  await content.fill(
    "## Our story\n\nGlow Beauty brings **everyday care** to your routine.\n\n### Our approach\n\n- Thoughtful products\n- Cash on delivery\n\n1. Choose your market\n2. Order your product\n\nRead our [care guide](https://example.com/care). \n\n<script>window.untrusted=true</script>",
  );
  await page
    .getByRole("textbox", { name: "Meta title", exact: true })
    .fill("About Glow Beauty — Our Story");
  await page
    .getByRole("textbox", { name: "Meta description", exact: true })
    .fill("Meet our everyday care brand.");
  await page
    .getByRole("checkbox", { name: "Show in navigation when published" })
    .check();
  await page
    .getByRole("textbox", { name: "Navigation label", exact: true })
    .fill("About Glow Beauty");
  await page.getByRole("button", { name: "Create page", exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/[0-9a-f-]+$/);
  const pageUrl = page.url();
  await page.getByRole("link", { name: "Preview saved draft" }).click();
  await expect(page.getByRole("heading", { name: "Our story" })).toBeVisible();
  await page.goto(pageUrl);
  await page.getByRole("button", { name: "Publish page", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Page published." }),
  ).toBeVisible();
  const customerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const customer = await customerContext.newPage();
  const storeRoot = publicUrl.split("/p/")[0];
  await customer.goto(`${storeRoot}?market=KE`);
  await expect(
    customer.getByRole("combobox", { name: "Store market", exact: true }),
  ).toHaveValue("KE");
  await expect(
    customer.getByRole("heading", {
      name: "Everyday care, delivered to your door.",
    }),
  ).toBeVisible();
  await expect(
    customer.getByRole("img", { name: "Glow Beauty logo" }),
  ).toBeVisible();
  const product = customer
    .locator(".store-product-card")
    .filter({ hasText: "Hair Growth Serum" });
  await expect(product).toContainText("KES 3,990.00");
  expect(
    await customer.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    customer
      .getByRole("navigation", { name: "Store navigation" })
      .getByRole("link", { name: "About Glow Beauty" }),
  ).toBeVisible();
  await customer.screenshot({
    path: "/tmp/africacod-checkpoint4-store-mobile.png",
    fullPage: true,
  });
  await customer
    .getByRole("navigation", { name: "Store navigation" })
    .getByRole("link", { name: "About Glow Beauty" })
    .click();
  await expect(
    customer.getByRole("heading", { name: "About Glow Beauty", exact: true }),
  ).toBeVisible();
  await expect(customer.locator(".content-body strong")).toHaveText(
    "everyday care",
  );
  await expect(customer.locator(".content-body ul li")).toHaveCount(2);
  await expect(customer.locator(".content-body ol li")).toHaveCount(2);
  await expect(customer).toHaveTitle(
    "About Glow Beauty — Our Story | Glow Beauty",
  );
  await expect(customer.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Meet our everyday care brand.",
  );
  expect(await customer.evaluate(() => "untrusted" in window)).toBe(false);
  await page.goto(pageUrl);
  await page
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("PRIVATE DRAFT CONTENT");
  await page
    .getByRole("textbox", { name: "Meta title", exact: true })
    .fill("PRIVATE SEO");
  await page.getByRole("button", { name: "Save page draft" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Draft saved." }),
  ).toBeVisible();
  await customer.reload();
  await expect(
    customer.getByRole("heading", { name: "Our story" }),
  ).toBeVisible();
  await expect(customer.getByText("PRIVATE DRAFT CONTENT")).toHaveCount(0);
  await expect(customer).toHaveTitle(
    "About Glow Beauty — Our Story | Glow Beauty",
  );
  await customer.goto(`${storeRoot}?market=GH`);
  await expect(customer.locator(".store-product-card")).toContainText(
    "GHS 399.00",
  );
  await customer.goto(`${storeRoot}/category/hair?market=KE`);
  await expect(customer.locator(".store-product-card")).toContainText(
    "Hair Growth Serum",
  );
  await customer.goto(`${storeRoot}/products?market=KE`);
  await customer
    .locator(".store-product-card")
    .filter({ hasText: "Hair Growth Serum" })
    .click();
  await expect(customer).toHaveURL(/market=KE/);
  await expect(customer.locator(".public-price strong")).toHaveText(
    "KES 3,990.00",
  );
  await customer.getByLabel("Full name").fill("CMS Kenyan Customer");
  await customer
    .getByRole("textbox", { name: "Phone number" })
    .fill("0712345678");
  await customer.getByLabel("County").fill("Nairobi");
  await customer.getByLabel("City / town").fill("Nairobi");
  await customer.getByLabel("Delivery address").fill("24 Garden Road, Nairobi");
  await customer.locator(".public-submit").click();
  await expect(
    customer.getByRole("heading", { name: "Thank you for your order." }),
  ).toBeVisible();
  const reference = (await customer
    .locator(".public-receipt strong")
    .textContent())!;
  await page.goto("/orders");
  await expect(
    page.getByRole("row").filter({ hasText: reference }),
  ).toContainText("CMS Kenyan Customer");
  await page.goto("/apps");
  await expect(
    page.getByRole("heading", { name: "Apps", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".app-card")).toHaveCount(10);
  await expect(page.locator(".app-card .badge")).toHaveText([
    ...Array(4).fill("Available (test adapter)"),
    "Coming soon",
    "Available (test adapter)",
    ...Array(4).fill("Coming soon"),
  ]);
  for (const button of await page
    .getByRole("button", { name: "Configuration unavailable" })
    .all())
    await expect(button).toBeDisabled();
  await customerContext.close();
});
