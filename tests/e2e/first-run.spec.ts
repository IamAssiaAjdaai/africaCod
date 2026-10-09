import { expect, test } from "@playwright/test";
import {
  createDatabase,
  memberships,
  user,
  visitorEvents,
  stores,
} from "../../packages/db/src/index";
import {
  eq,
  and,
  count,
} from "../../packages/db/node_modules/drizzle-orm/index.js";
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
  await expect(page).toHaveURL(/\/stores\/new$/);
  await expect(page.getByLabel("Organization name")).toHaveCount(0);
  const database = createDatabase(process.env.DATABASE_URL!);
  try {
    const [account] = await database.db
      .select()
      .from(user)
      .where(eq(user.email, `first-run-${suffix}@example.com`));
    const roles = await database.db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, account.id));
    expect(roles).toHaveLength(1);
    expect(roles[0].role).toBe("owner");
  } finally {
    await database.client.end();
  }
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
  const storePath = new URL(page.url()).pathname;
  await expect(
    page.getByText("Add a market to preview your Store.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Preview Store", exact: true }),
  ).toHaveCount(0);
  await page.goto(`${storePath}/preview`);
  await expect(
    page.getByRole("heading", { name: "Preview unavailable" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add Market", exact: true }).click();
  await page
    .getByRole("button", { name: "Add Market", exact: true })
    .first()
    .click();
  for (const country of ["Kenya", "Ghana", "Guinea", "Rwanda"]) {
    await page.getByLabel("Search countries").fill(country);
    await expect(
      page.getByRole("radio", { name: new RegExp(country) }).first(),
    ).toBeVisible();
  }
  await page.getByLabel("Search countries").fill("Cote d'Ivoire");
  await expect(
    page.getByRole("radio", { name: /Côte d.Ivoire/ }),
  ).toBeVisible();
  await page.getByLabel("Search countries").fill("United States");
  await expect(
    page.getByText("No countries found. Try another name or country code."),
  ).toBeVisible();
  await page.getByLabel("Search countries").fill("Kenya");
  await page.getByRole("radio", { name: /Kenya/ }).check();
  await page.getByRole("button", { name: "Add selected market" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Preview Store", exact: true }).click();
  await expect(page.getByText(/Private Draft preview/)).toBeVisible();
  await expect(page.getByLabel("Store market")).toHaveValue("KE");
  await expect(page.getByLabel("Store market").locator("..")).toContainText(
    "Previewing:",
  );
  await expect(
    page.getByRole("heading", { name: "Choose your market" }),
  ).toHaveCount(0);
  await page.goto(storePath);
  await page
    .getByRole("button", { name: "Add Market", exact: true })
    .first()
    .click();
  await page.getByLabel("Search countries").fill("Ghana");
  await page.getByRole("radio", { name: /Ghana/ }).check();
  await page.getByRole("button", { name: "Add selected market" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Preview Store", exact: true }).click();
  await expect(page.getByLabel("Store market")).toHaveValue("GH");
  await page.getByLabel("Store market").selectOption("KE");
  await expect(page).toHaveURL(/market=KE/);
  await expect(page.getByLabel("Store market")).toHaveValue("KE");
  const verified = createDatabase(process.env.DATABASE_URL!);
  try {
    const [store] = await verified.db
      .select()
      .from(stores)
      .where(eq(stores.slug, `beauty-shop-${suffix}`));
    const [events] = await verified.db
      .select({ total: count() })
      .from(visitorEvents)
      .where(
        and(
          eq(visitorEvents.storeId, store.id),
          eq(visitorEvents.organizationId, store.organizationId),
        ),
      );
    expect(events.total).toBe(0);
    expect(store.settingsPublishedAt).toBeNull();
  } finally {
    await verified.client.end();
  }
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.locator(".dashboard-store-setup > summary").click();
  await expect(
    page.getByRole("heading", { name: "Get your Store ready" }),
  ).toBeVisible();
  await page.goto("/stores/new");
  await expect(
    page.getByRole("heading", { name: "Create Store", exact: true }),
  ).toBeVisible();
});
