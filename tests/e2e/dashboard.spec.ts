import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  createDatabase,
  organizations,
  stores,
} from "../../packages/db/src/index";
import { eq } from "../../packages/db/node_modules/drizzle-orm/index.js";
import { captureDashboard } from "./dashboard-screenshot";

test("Dashboard scopes, filters, empty states and keyboard navigation", async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(20000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const merchantName = "Alexandra Njeri Merchant with a very long account name";
  const workspaceName =
    "East Africa Commerce Collective — Regional Operations and Merchant Support Workspace";
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(merchantName);
  await page
    .getByLabel("Email address")
    .fill(`dashboard-${suffix}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Dashboard-audit-password-2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/stores\/new$/);
  await page
    .getByLabel("Store name")
    .fill("Commerce studio with a longer store name");
  await page.getByLabel("Store address").fill(`dashboard-${suffix}`);
  await page.getByRole("button", { name: "Create store", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/[0-9a-f-]+$/);
  const storeId = page.url().split("/").at(-1)!;
  // This fixture is confined to the disposable database created by test-e2e.ts.
  const database = createDatabase(process.env.DATABASE_URL!);
  try {
    const [store] = await database.db
      .select()
      .from(stores)
      .where(eq(stores.id, storeId));
    await database.db
      .update(organizations)
      .set({ name: workspaceName })
      .where(eq(organizations.id, store.organizationId));
  } finally {
    await database.client.end();
  }
  await page.goto("/dashboard");

  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const routes = [
    "/dashboard",
    "/orders",
    "/orders/confirmation",
    "/fulfillment",
    "/products",
    "/categories",
    "/stores",
    "/pages",
    "/analytics",
    "/apps",
    "/settings",
  ];
  await expect(nav.getByRole("link")).toHaveCount(routes.length);
  expect(
    await nav
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual(routes);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("Dashboard");
  await expect(
    page.getByRole("group", { name: "Current organization" }),
  ).toContainText("Organization · Owner");
  await expect(page.locator(".dashboard-stores")).toContainText(
    "Stores belong to your organization",
  );
  await expect(
    page.getByRole("region", { name: "Period metrics" }).locator(".stat-card"),
  ).toHaveCount(4);
  const operationalDetails = page.locator(".dashboard-operations");
  await expect(operationalDetails).not.toHaveAttribute("open");
  await operationalDetails.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(
    page
      .getByRole("region", { name: "All-time operational counts" })
      .locator(".stat-card"),
  ).toHaveCount(9);
  for (const id of [
    "metric-new-/-awaiting-confirmation",
    "metric-callback-due",
    "metric-ready-for-fulfillment",
  ]) {
    await expect(page.getByTestId(id)).toHaveCount(1);
  }
  await page.keyboard.press("Space");
  await expect(operationalDetails).not.toHaveAttribute("open");
  await expect(page.locator(".dashboard-store-list")).toContainText(
    "Active · Draft storefront",
  );
  await expect(page.locator(".dashboard-store-details dl")).not.toBeVisible();
  await page.locator(".dashboard-store-details summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".dashboard-store-details dl")).toContainText(
    storeId,
  );
  await expect(page.locator(".dashboard-store-details dl")).toContainText(
    `/s/dashboard-${suffix}`,
  );
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", {
      name: "Ready for your first order",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-period-empty")).toContainText(
    "Create a product and finish your store setup",
  );
  const actions = page.getByRole("navigation", {
    name: "Dashboard quick actions",
  });
  await expect(actions.getByRole("link")).toHaveCount(3);
  expect(
    await actions.evaluate((element) => {
      const performance = document.querySelector(".dashboard-range")!;
      const setup = document.querySelector(".dashboard-store-setup")!;
      return [performance, setup].every(
        (section) =>
          !!(
            element.compareDocumentPosition(section) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
      );
    }),
  ).toBe(true);
  await expect(page.locator(".dashboard-order-previews")).not.toHaveAttribute(
    "open",
  );
  expect(
    (
      await page.locator(".dashboard-disclosure > summary").allTextContents()
    ).join(" "),
  ).not.toMatch(
    /No orders to preview|No Product data|No source data|No Market/,
  );
  await expect(
    page.getByRole("link", { name: "Create Product", exact: true }),
  ).toHaveCount(1);
  for (const link of await actions.getByRole("link").all()) {
    await expect(link).toContainText("all time");
    await expect(link.locator(".quick-action-count")).toHaveText("0");
  }

  const filters = page.getByRole("form", {
    name: "Dashboard date and store filters",
  });
  await filters.getByLabel("Date range").selectOption("custom");
  await filters.locator(".dashboard-custom-dates summary").click();
  await filters.getByLabel("From (Custom)", { exact: true }).fill("2026-09-28");
  await filters.getByLabel("To (Custom)", { exact: true }).fill("2026-09-30");
  await filters.getByLabel("Store").selectOption(storeId);
  await filters.getByRole("button", { name: "Apply range" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/dashboard" &&
      url.searchParams.get("range") === "custom" &&
      url.searchParams.get("from") === "2026-09-28" &&
      url.searchParams.get("to") === "2026-09-30" &&
      url.searchParams.get("storeId") === storeId,
  );
  await expect(filters.getByLabel("Date range")).toHaveValue("custom");
  await expect(page.locator(".dashboard-chart-panel")).toContainText(
    "2026-09-28 — 2026-09-30 · UTC",
  );
  const dailyCounts = page.locator(
    ".dashboard-chart-panel .dashboard-daily-counts > summary",
  );
  await dailyCounts.focus();
  await page.keyboard.press("Enter");
  const table = page.getByRole("region", { name: "Daily counts data table" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByRole("row").last()).toContainText("2026-09-30");
  await table.focus();
  await expect(table).toBeFocused();
  await dailyCounts.focus();
  await page.keyboard.press("Space");
  await expect(table).not.toBeVisible();

  await filters.getByLabel("From (Custom)", { exact: true }).fill("2026-10-01");
  await filters.getByRole("button", { name: "Apply range" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("metric-orders").locator("strong")).toHaveText(
    "0",
  );
  await page.goto("/dashboard");
  await expect(page.locator(".dashboard-chart svg")).toHaveCount(0);
  await expect(page.locator(".chart-empty")).toContainText(
    "Daily counts include days with zero activity",
  );
  const definitions = page.locator(".dashboard-metric-definitions");
  await definitions.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(definitions.locator("dl")).toBeVisible();
  await expect(definitions.locator("dl")).toContainText("not unique people");
  await page.keyboard.press("Space");
  await expect(definitions.locator("dl")).not.toBeVisible();

  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const helper = await page.locator(".chart-empty").evaluate((element) => ({
      font: parseFloat(getComputedStyle(element).fontSize),
      line: parseFloat(getComputedStyle(element).lineHeight),
    }));
    expect(helper.font, `${width}px explanatory text`).toBeGreaterThanOrEqual(
      13,
    );
    expect(helper.line).toBeGreaterThanOrEqual(19.5);
    if (width === 375) {
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight),
      ).toBeLessThan(3000);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${width}px overflow`,
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .include(".app-shell")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations, `${width}px accessibility`).toEqual([]);
    await captureDashboard(page, `test-results/dashboard-audit-${width}.png`);
  }

  // Every secondary section is reachable by keyboard and checked while open.
  for (const summary of await page
    .locator(".dashboard-disclosure > summary")
    .all()) {
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(summary.locator("..")).toHaveAttribute("open");
  }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      (
        await new AxeBuilder({ page })
          .include(".app-shell")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await captureDashboard(
      page,
      `test-results/dashboard-audit-expanded-${width}.png`,
    );
  }
  for (const summary of await page
    .locator(".dashboard-disclosure > summary")
    .all()) {
    await summary.focus();
    await page.keyboard.press("Space");
  }

  await page.setViewportSize({ width: 375, height: 667 });
  const opener = page.getByRole("button", { name: "Open menu", exact: true });
  await expect(nav).not.toBeVisible();
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(drawer).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close menu", exact: true }),
  ).toBeFocused();
  expect(
    await page.locator(".app-main").evaluate((el) => (el as HTMLElement).inert),
  ).toBe(true);
  expect(await page.locator("body").evaluate((el) => el.style.overflow)).toBe(
    "hidden",
  );
  const accountMenu = drawer.locator(".user-menu summary");
  await expect(accountMenu).toHaveAttribute(
    "aria-label",
    `Account menu for ${merchantName}`,
  );
  expect(
    await drawer.locator(".sidebar-user-name").evaluate((element) => ({
      truncated: element.scrollWidth > element.clientWidth,
      whiteSpace: getComputedStyle(element).whiteSpace,
    })),
  ).toEqual({ truncated: true, whiteSpace: "nowrap" });
  expect(
    await drawer
      .locator(".org-card strong")
      .evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);
  await accountMenu.focus();
  await page.keyboard.press("Enter");
  const accountDetails = drawer.getByRole("region", {
    name: "Full account details",
  });
  await expect(accountDetails).toContainText(merchantName);
  await expect(accountDetails).toContainText(workspaceName);
  await expect(accountDetails.locator("dt")).toContainText([
    "Signed in as",
    "Organization",
    "Email",
  ]);
  await accountDetails.focus();
  await expect(accountDetails).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".app-shell")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/dashboard-audit-mobile-account.png",
  });
  const accountSettings = drawer.getByRole("link", {
    name: "Account settings",
  });
  await expect(accountSettings).toBeVisible();
  await expect(accountSettings).toHaveAttribute("href", "/settings");
  expect((await accountSettings.boundingBox())?.height).toBeGreaterThanOrEqual(
    44,
  );
  await accountSettings.focus();
  await expect(accountSettings).toBeFocused();
  await accountMenu.focus();
  await page.keyboard.press("Enter");
  await expect(accountSettings).not.toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".sidebar-brand a")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeFocused();
  const drawerAxe = await new AxeBuilder({ page })
    .include(".app-shell")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(drawerAxe.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/dashboard-audit-mobile-navigation.png",
  });
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  expect(
    await page.locator(".app-main").evaluate((el) => (el as HTMLElement).inert),
  ).toBe(false);
  expect(await page.locator("body").evaluate((el) => el.style.overflow)).toBe(
    "",
  );

  await opener.click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(drawer).toHaveCount(0);
  await expect(nav).toBeVisible();
  expect(
    await page.locator(".app-main").evaluate((el) => (el as HTMLElement).inert),
  ).toBe(false);
  expect(await page.locator("body").evaluate((el) => el.style.overflow)).toBe(
    "",
  );

  await page.setViewportSize({ width: 375, height: 667 });
  await opener.click();
  await page
    .getByRole("button", { name: "Close navigation", exact: true })
    .click({ position: { x: 350, y: 100 } });
  await expect(opener).toBeFocused();
  await opener.click();
  await nav.getByRole("link", { name: "Confirmation", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/confirmation$/);
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  await opener.click();
  await expect(nav.locator('[aria-current="page"]')).toHaveText("Confirmation");
  await page.keyboard.press("Escape");

  await page.goto("/orders/callbacks");
  await opener.click();
  await expect(nav.locator('[aria-current="page"]')).toHaveText("Confirmation");
  await page.keyboard.press("Escape");
  await page.goto("/dashboard");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(errors).toEqual([]);
});
