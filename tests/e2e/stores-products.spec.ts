import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { captureDashboard as captureWorkspace } from "./dashboard-screenshot";

const password = "Test-phase2-catalog-2026!";

test("Stores and products preserve independent statuses, filters, market prices and accessible responsive editing", async ({
  page,
}, testInfo) => {
  test.setTimeout(420000);
  page.setDefaultTimeout(20000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const storeName = "Glow Beauty — Everyday Care and Wellness Studio";
  const productName = "Daily Hair Growth Serum — Botanical Care Collection";

  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Phase Two Merchant");
  await page.getByLabel("Email address").fill(`phase2-${suffix}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/stores\/new$/);

  for (const [route, title, action] of [
    ["/stores", "No stores yet.", "Create your first store"],
    ["/products", "No products yet", "Create store"],
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: action, exact: true }).last(),
    ).toHaveAttribute("href", "/stores/new");
    expect(
      (await new AxeBuilder({ page }).include("main").analyze()).violations,
    ).toEqual([]);
  }

  await page.goto("/stores/new");
  await page.getByLabel("Store name").fill(storeName);
  await page.getByLabel("Store address").fill(`phase2-${suffix}`);
  await page.getByRole("button", { name: "Create store", exact: true }).click();
  await expect(page).toHaveURL(/\/stores\/[0-9a-f-]+$/);
  const storeUrl = page.url();
  const storeId = storeUrl.split("/").at(-1)!;
  await expect(
    page.locator("#store-overview").getByText("Organization", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#store-overview dd").nth(1)).toHaveText(
    `/s/phase2-${suffix}`,
  );
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const publicStoreUrl = await page.getByLabel("Store URL").inputValue();
  await page.getByRole("button", { name: "Copy URL", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Store URL copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    publicStoreUrl,
  );
  await expect(
    page
      .getByRole("navigation", { name: "Store sections" })
      .getByRole("link", { name: "Catalog", exact: true }),
  ).toHaveAttribute("href", "#store-catalog");
  await expect(
    page
      .locator("#store-catalog")
      .getByRole("link", { name: "Products", exact: true }),
  ).toHaveAttribute("href", `/products?storeId=${storeId}`);

  await page.goto(`/products?storeId=${storeId}`);
  await expect(
    page.getByRole("heading", { name: "No products yet", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".empty-state .form-actions")).toHaveText(
    "Add Product",
  );
  await page.goto(storeUrl);

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
  const ghana = page.getByRole("row").filter({ hasText: "Ghana" });
  await ghana
    .getByRole("button", { name: "Deactivate Ghana", exact: true })
    .click();
  await expect(
    ghana.getByRole("button", { name: "Activate Ghana", exact: true }),
  ).toBeVisible();
  await page.goto("/stores");
  const card = page.getByRole("article", { name: storeName, exact: true });
  await expect(card).not.toContainText(`/s/phase2-${suffix}`);
  await expect(card).toContainText("1 active · 2 total markets");
  await expect(card.getByText("Active store", { exact: true })).toBeVisible();
  await expect(
    card.getByText("Draft storefront", { exact: true }),
  ).toBeVisible();
  await expect(
    card.getByRole("link", { name: `Manage ${storeName}`, exact: true }),
  ).toHaveAttribute("href", `/stores/${storeId}`);
  await expect(
    card.getByRole("link", { name: `Settings for ${storeName}`, exact: true }),
  ).toHaveAttribute("href", `/stores/${storeId}/settings`);
  await page.goto(storeUrl);
  await page
    .getByRole("row")
    .filter({ hasText: "Ghana" })
    .getByRole("button", { name: "Activate Ghana", exact: true })
    .click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Ghana" })
      .getByRole("button", { name: "Deactivate Ghana", exact: true }),
  ).toBeVisible();

  await page.goto(`/products/new?storeId=${storeId}`);
  await page.getByLabel("Name", { exact: true }).fill(productName);
  await page.getByLabel("SKU", { exact: true }).fill("BOTANICAL-001");
  await page
    .getByLabel("Short description")
    .fill("Botanical care for your everyday routine.");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Apply a small amount to your scalp each day.");
  await page
    .getByRole("combobox", { name: "Product status", exact: true })
    .selectOption("active");
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
    .fill("Botanical serum bottle");
  await page.getByRole("button", { name: "Upload image", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Image uploaded." }),
  ).toBeVisible();
  for (const [country, price] of [
    ["Kenya", "100"],
    ["Ghana", "10"],
  ]) {
    await page.locator("summary").filter({ hasText: country }).click();
    const offer = page.getByRole("form", {
      name: `${country} offer`,
      exact: true,
    });
    await offer.getByLabel(/^Price \(/).fill(price);
    await offer
      .getByRole("button", { name: `Save ${country} offer`, exact: true })
      .click();
    await expect(offer.getByRole("status")).toContainText("Offer saved.");
  }
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Product status", exact: true }),
  ).toHaveValue("active");
  await expect(
    page
      .getByRole("form", { name: "Kenya offer", exact: true })
      .getByLabel("Price (KES)", { exact: true }),
  ).toHaveValue("100.00");
  await expect(
    page
      .getByRole("form", { name: "Ghana offer", exact: true })
      .getByLabel("Price (GHS)", { exact: true }),
  ).toHaveValue("10.00");
  await page.route(productUrl, async (route) => {
    if (route.request().method() === "POST")
      await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  const information = page.getByRole("form", {
    name: "Product information",
    exact: true,
  });
  await expect(information).toHaveAttribute("aria-busy", "true");
  await expect(information.getByLabel("Name", { exact: true })).toBeDisabled();
  await expect(information.getByRole("status")).toContainText("Product saved.");
  await expect(information).toHaveAttribute("aria-busy", "false");
  await page.unroute(productUrl);

  // Section navigation keeps all independently saved forms and drafts mounted.
  await page.setViewportSize({ width: 375, height: 812 });
  const sections = page.getByRole("navigation", { name: "Product sections" });
  await expect(sections.getByRole("link")).toHaveCount(5);
  await expect(sections).toContainText("2 saved offers");
  await information.getByLabel("SKU", { exact: true }).fill("UNSAVED-SKU");
  await page.getByLabel("Headline", { exact: true }).fill("Unsaved headline");
  for (const [label, target, position] of [
    ["Markets & pricing", "market-offers", 2],
    ["Media", "product-media", 3],
    ["Variants", "product-variants", 4],
    ["Storefront", "product-storefront", 5],
    ["Product details", "product-information", 1],
  ] as const) {
    const link = sections.getByRole("link", { name: new RegExp(label) });
    await link.focus();
    await page.keyboard.press("Enter");
    const destination = page.locator(`#${target}`);
    await expect(destination).toBeFocused();
    await expect(link).toHaveAttribute("aria-current", "location");
    await expect(page.locator(".product-section-guidance")).toContainText(
      `Section ${position} of 5`,
    );
    const bounds = await page.evaluate((id) => {
      const menu = document
        .querySelector(".product-section-navigation")!
        .getBoundingClientRect();
      const destination = document.getElementById(id)!.getBoundingClientRect();
      return { top: menu.top, bottom: menu.bottom, target: destination.top };
    }, target);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.top).toBeLessThanOrEqual(9);
    expect(bounds.target).toBeGreaterThan(bounds.bottom);
  }
  await expect(information.getByLabel("SKU", { exact: true })).toHaveValue(
    "UNSAVED-SKU",
  );
  await expect(page.getByLabel("Headline", { exact: true })).toHaveValue(
    "Unsaved headline",
  );
  await sections.getByRole("link", { name: /Markets & pricing/ }).click();
  const kenyaOffer = page.getByRole("form", {
    name: "Kenya offer",
    exact: true,
  });
  await kenyaOffer.getByLabel("Cost (KES)", { exact: true }).fill("20");
  await kenyaOffer.getByRole("button", { name: "Save Kenya offer" }).click();
  await expect(kenyaOffer.getByRole("status")).toContainText("Offer saved.");
  await expect(information.getByLabel("SKU", { exact: true })).toHaveValue(
    "UNSAVED-SKU",
  );
  await expect(page.getByLabel("Headline", { exact: true })).toHaveValue(
    "Unsaved headline",
  );
  const ghanaOffer = page.getByRole("form", {
    name: "Ghana offer",
    exact: true,
  });
  await ghanaOffer.getByLabel("Cost (GHS)", { exact: true }).fill("3");
  await information.getByLabel("SKU", { exact: true }).fill("BOTANICAL-001");
  await information.getByRole("button", { name: "Save product" }).click();
  await expect(
    information.getByRole("button", { name: "Save product", exact: true }),
  ).toBeEnabled();
  await expect(information.getByRole("status")).toContainText("Product saved.");
  await expect(
    kenyaOffer.getByLabel("Cost (KES)", { exact: true }),
  ).toHaveValue("20.00");
  await expect(
    ghanaOffer.getByLabel("Cost (GHS)", { exact: true }),
  ).toHaveValue("3");
  await expect(page.getByLabel("Headline", { exact: true })).toHaveValue(
    "Unsaved headline",
  );
  await page.getByLabel("Headline", { exact: true }).fill(productName);
  await ghanaOffer.getByLabel("Cost (GHS)", { exact: true }).fill("");
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(`/products/new?storeId=${storeId}`);
  await page
    .getByLabel("Name", { exact: true })
    .fill("Everyday Care Travel Set");
  await page.getByLabel("SKU", { exact: true }).fill("TRAVEL-002");
  await page
    .getByRole("button", { name: "Create product", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);
  await page.goto("/products");
  const filters = page.getByRole("form", { name: "Product filters" });
  await filters.getByLabel("Search products").fill("botanical-001");
  await filters
    .getByRole("combobox", { name: "Store", exact: true })
    .selectOption(storeId);
  await filters
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("active");
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("link", { name: `Edit ${productName}`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Edit Everyday Care Travel Set",
      exact: true,
    }),
  ).toHaveCount(0);
  const row = page.getByRole("row").filter({ hasText: productName });
  await expect(row).toContainText("KES 100.00");
  await expect(row).toContainText("GHS 10.00");
  await expect(row.getByText("Active", { exact: true })).toBeVisible();
  await expect(row.getByText("Draft", { exact: true })).toBeVisible();
  await expect(
    row.getByRole("img", { name: "Botanical serum bottle" }),
  ).toBeVisible();
  await filters.getByLabel("Search products").fill("missing-product");
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("heading", { name: "No products match", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Clear all filters", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(filters.getByLabel("Search products")).toHaveValue("");
  await expect(
    filters.getByRole("combobox", { name: "Store", exact: true }),
  ).toHaveValue("");
  await expect(
    filters.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("link", {
      name: "Edit Everyday Care Travel Set",
      exact: true,
    }),
  ).toBeVisible();
  await filters
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("draft");
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("link", { name: `Edit ${productName}`, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: "Edit Everyday Care Travel Set",
      exact: true,
    }),
  ).toBeVisible();

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`/stores/${storeId}/settings`);
  const readiness = page.locator(".store-settings-setup");
  await expect(readiness).not.toHaveAttribute("open", "");
  await readiness.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Store URL")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Store URL")).not.toBeVisible();
  const appearance = page.getByRole("tab", { name: "Appearance", exact: true });
  await appearance.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Product Page", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Product Page", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Markets", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(appearance).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tabpanel")).toBeFocused();
  await page
    .getByLabel("Tagline", { exact: true })
    .fill("Care for your everyday routine.");
  const identity = page.locator("#settings-identity");
  await identity.locator("summary").focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Tagline", { exact: true })).not.toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Tagline", { exact: true })).toHaveValue(
    "Care for your everyday routine.",
  );
  const theme = page.locator("#settings-theme");
  await expect(theme).not.toHaveAttribute("open", "");
  await theme.locator("summary").focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Brand Color HEX").fill("#265a8f");
  await theme.locator("summary").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Brand Color HEX")).toHaveValue("#265a8f");
  await page.getByRole("tab", { name: "Product Page", exact: true }).click();
  await appearance.click();
  await theme.locator("summary").click();
  await expect(page.getByLabel("Brand Color HEX")).toHaveValue("#265a8f");
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  await page.reload();
  await expect(page.getByLabel("Tagline", { exact: true })).toHaveValue(
    "Care for your everyday routine.",
  );
  await theme.locator("summary").click();
  await expect(page.getByLabel("Brand Color HEX")).toHaveValue("#265a8f");
  await page.getByLabel("Brand Color HEX").fill("#147d64");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");

  const routes = [
    ["stores-list", "/stores"],
    ["store-detail", `/stores/${storeId}`],
    ["products-list", "/products"],
    ["product-editor", productUrl],
    ["store-settings", `/stores/${storeId}/settings`],
  ];
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, route] of routes) {
      await page.goto(route);
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${name} at ${width}px overflows`,
      ).toBe(true);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations, `${name} at ${width}px accessibility`).toEqual(
        [],
      );
      if (width !== 768) {
        if (name === "product-editor") {
          const image = page.getByRole("img", {
            name: "Botanical serum bottle",
            exact: true,
          });
          await image.scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              image.evaluate(
                (element) => (element as HTMLImageElement).naturalWidth,
              ),
            )
            .toBeGreaterThan(0);
        }
        const path = `test-results/phase2-refined-${name}-${width}.png`;
        await captureWorkspace(page, path);
        await testInfo.attach(`${name}-${width}`, {
          path,
          contentType: "image/png",
        });
      }
      if (name === "store-settings") {
        await expect(page.locator(".settings-group")).toHaveCount(6);
        const spacing = await page
          .locator(".settings-groups")
          .evaluate((element) => {
            const groups = [...element.children];
            return groups
              .slice(1)
              .map(
                (group, index) =>
                  group.getBoundingClientRect().top -
                  groups[index].getBoundingClientRect().bottom,
              );
          });
        for (const gap of spacing) expect(gap).toBeLessThanOrEqual(13);
        for (const group of await page.locator(".settings-group").all()) {
          if (
            !(await group.evaluate(
              (element) => (element as HTMLDetailsElement).open,
            ))
          )
            await group.locator("summary").click();
        }
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
          `Expanded Appearance at ${width}px accessibility`,
        ).toEqual([]);
      }
      if (name === "product-editor") {
        const mediaLink = page
          .getByRole("navigation", { name: "Product sections" })
          .getByRole("link", { name: /Media/ });
        await mediaLink.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("#product-media")).toBeFocused();
        await expect(mediaLink).toHaveAttribute("aria-current", "location");
        expect(
          await page.evaluate(() => {
            const menu = document
              .querySelector(".product-section-navigation")!
              .getBoundingClientRect();
            const media = document
              .getElementById("product-media")!
              .getBoundingClientRect();
            return media.top > menu.bottom && menu.top >= 0 && menu.top <= 9;
          }),
          `Sticky navigation and media anchor at ${width}px`,
        ).toBe(true);
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
          `Scrolled Product Editor at ${width}px accessibility`,
        ).toEqual([]);
        if (width !== 768) {
          const path = `test-results/phase2-refined-editor-navigation-${width}.png`;
          await page.screenshot({ path, fullPage: false });
          await testInfo.attach(`editor-navigation-${width}`, {
            path,
            contentType: "image/png",
          });
        }
      }
      if (name === "products-list") {
        const search = page.locator(".product-search .search-field");
        const layout = await search.evaluate((element) => {
          const input = element.querySelector("input")!.getBoundingClientRect();
          const icon = element.querySelector("svg")!.getBoundingClientRect();
          return {
            extraHeight: element.getBoundingClientRect().height - input.height,
            iconOffset: Math.abs(
              icon.y + icon.height / 2 - input.y - input.height / 2,
            ),
          };
        });
        expect(
          layout.extraHeight,
          "Search wrapper adds empty vertical space",
        ).toBeLessThanOrEqual(1);
        expect(
          layout.iconOffset,
          "Search icon is centered in its input",
        ).toBeLessThanOrEqual(1);
      }
      if (name === "products-list" && width === 375) {
        await expect(page.getByRole("table")).toBeVisible();
        await expect(
          page.getByRole("columnheader", { name: "Configured market offers" }),
        ).toHaveCount(1);
        await expect(
          page
            .getByRole("row")
            .filter({ hasText: productName })
            .getByRole("cell"),
        ).toHaveCount(7);
        const table = page.getByRole("region", { name: "Products data table" });
        expect(
          await table.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ).toBe(true);
      }
      if (name === "store-detail" && width === 375) {
        const table = page.getByRole("region", {
          name: "Configured markets data table",
        });
        await table.focus();
        await page.keyboard.press("ArrowRight");
        await expect
          .poll(() => table.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
      }
    }
  }
  expect(errors).toEqual([]);
});
