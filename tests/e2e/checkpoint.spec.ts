import { expect, test, type Page } from "@playwright/test";
const password = "Test-checkpoint-password-2026!";
async function register(page: Page, suffix: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Checkpoint Merchant");
  await page.getByLabel("Email address").fill(`merchant-${suffix}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Organization name").fill(`Commerce ${suffix}`);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/stores\/new$/);
}
test("sign up → organization → zero-market store → searchable countries; preserves deactivated markets", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await register(page, suffix);
  await expect(
    page.getByRole("heading", { name: "Create your first Store" }),
  ).toBeVisible();
  await page.getByLabel("Store name").fill("Glow Beauty");
  await page.getByLabel("Store address").fill(`glow-${suffix}`);
  await page.getByRole("button", { name: "Create store", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "No markets yet" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add Market", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Search countries").fill("Kenya");
  await dialog.getByText("Kenya", { exact: true }).click();
  await dialog.getByRole("button", { name: "Add selected market" }).click();
  await expect(dialog).not.toBeVisible();
  const kenya = page.getByRole("row").filter({ hasText: "Kenya" });
  await expect(kenya).toContainText("KES");
  await expect(kenya.getByText("Active", { exact: true })).toBeVisible();
  await page.reload();
  await expect(kenya).toContainText("KES");
  await page.getByRole("button", { name: "Add Market", exact: true }).click();
  await expect(dialog.getByText("Kenya", { exact: true })).toHaveCount(0);
  await dialog.getByLabel("Search countries").fill("Ghana");
  await dialog.getByText("Ghana", { exact: true }).click();
  await dialog.getByRole("button", { name: "Add selected market" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Ghana" }),
  ).toContainText("GHS");
  for (const [query, name, currency] of [
    ["rWaNdA", "Rwanda", "RWF"],
    ["Angola", "Angola", "AOA"],
  ]) {
    await page.getByRole("button", { name: "Add Market", exact: true }).click();
    await dialog.getByLabel("Search countries").fill("No such country");
    await expect(
      dialog.getByText("No countries found. Try another name or country code."),
    ).toBeVisible();
    await dialog.getByLabel("Search countries").fill(query);
    await dialog.getByText(name, { exact: true }).click();
    await dialog.getByRole("button", { name: "Add selected market" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: name })).toContainText(
      currency,
    );
  }
  await page
    .getByRole("button", { name: "Deactivate Kenya", exact: true })
    .click();
  await expect(kenya.getByText("Inactive", { exact: true })).toBeVisible();
  await page.reload();
  await expect(kenya).toContainText("Inactive");
  await page
    .getByRole("button", { name: "Activate Kenya", exact: true })
    .click();
  await expect(kenya.getByText("Active", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel("Email address").fill(`merchant-${suffix}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
test("unauthenticated routes redirect to sign in", async ({ page }) => {
  for (const route of [
    "/dashboard",
    "/stores",
    "/stores/new",
    `/stores/${crypto.randomUUID()}`,
    "/settings",
    "/onboarding",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
});
test("a second account cannot load another organization's store by changing the URL", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await register(pageA, `a-${suffix}`);
  await pageA.goto("/stores/new");
  await pageA.getByLabel("Store name").fill("Private Tenant Store");
  await pageA.getByLabel("Store address").fill(`private-${suffix}`);
  await pageA
    .getByRole("button", { name: "Create store", exact: true })
    .click();
  await expect(pageA).toHaveURL(/\/stores\/[0-9a-f-]+$/);
  const privateUrl = pageA.url();
  await register(pageB, `b-${suffix}`);
  await pageB.goto(privateUrl);
  await expect(
    pageB.getByRole("heading", { name: "We couldn’t find that page." }),
  ).toBeVisible();
  await expect(
    pageB.getByRole("heading", { name: "Private Tenant Store" }),
  ).toHaveCount(0);
  await ctxA.close();
  await ctxB.close();
});
test("landing and sign-up fit a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/", "/sign-up"]) {
    await page.goto(route);
    await expect(page.locator("h1:visible")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
