import { expect, test } from "@playwright/test";
test("new merchant is guided to first Store; Draft is private and second Store uses normal creation", async ({
  page,
  browser,
}) => {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("First-run Merchant");
  await page
    .getByLabel("Email address")
    .fill(`first-run-${suffix}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Test-first-run-password-2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Organization name").fill(`First-run ${suffix}`);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/stores\/new$/);
  await expect(
    page.getByRole("heading", { name: "Create your first Store" }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/stores\/new$/);
  await page.getByLabel("Store name").fill("Beauty Shop");
  await expect(page.getByLabel("Store address")).toHaveValue("beauty-shop");
  await page.getByLabel("Store address").fill(`beauty-shop-${suffix}`);
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Create store", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "No markets yet" }),
  ).toBeVisible();
  await expect(page.getByText("1 of 6 completed")).toBeVisible();
  const url = await page.getByLabel("Store URL").inputValue();
  expect(url).toBe(`http://localhost:3100/s/beauty-shop-${suffix}`);
  await expect(
    page.getByRole("link", { name: "View Store", exact: true }),
  ).toHaveCount(0);
  const context = await browser.newContext();
  const visitor = await context.newPage();
  await visitor.goto(url);
  await expect(
    visitor.getByRole("heading", { name: "We couldn’t find that page." }),
  ).toBeVisible();
  await expect(visitor.locator(".storefront-shell")).toHaveCount(0);
  await context.close();
  await page.getByRole("link", { name: "Preview Store", exact: true }).click();
  await expect(page.getByText(/Private Draft preview/)).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Get your Store ready" }),
  ).toBeVisible();
  await page.goto("/stores/new");
  await expect(
    page.getByRole("heading", { name: "Create Store", exact: true }),
  ).toBeVisible();
});
