import { spawn } from "node:child_process";
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { migrate } from "../packages/db/node_modules/drizzle-orm/postgres-js/migrator";
import { createDatabase, seedCountries, user } from "../packages/db/src/index";
import {
  StoreSettingsService,
  OperationsService,
  defaultPageConfig,
} from "../packages/domain/src/index";
import { loadRootEnvironment } from "../packages/shared/src/node";
loadRootEnvironment();
const url = new URL(process.env.DATABASE_URL!);
if (
  process.env.APP_ENV === "production" ||
  !["localhost", "127.0.0.1"].includes(url.hostname)
)
  throw new Error("Local profiling only");
url.pathname = "/africacod_profile_test";
const fixturePath = "/tmp/africacod-profile-fixture.json";
const { db, client } = createDatabase(url.toString());
if (process.argv[2] === "setup") {
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = createDatabase(adminUrl.toString());
  await admin.client.unsafe('CREATE DATABASE "africacod_profile_test"');
  await admin.client.end();
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../packages/db/drizzle", import.meta.url),
    ),
  });
  await seedCountries(db);
  const id = crypto.randomUUID();
  await db
    .insert(user)
    .values({ id, name: "Profiling Merchant", email: `${id}@example.com` });
  const service = new StoreSettingsService(db),
    ops = new OperationsService(db);
  await service.createOrganization(id, { name: "Profiling workspace" });
  const store = await service.createStore(id, {
    name: "Profiling Store",
    slug: "profiling-store",
  });
  const market = await service.addMarket(id, {
    storeId: store.id,
    countryCode: "KE",
  });
  const product = await service.createProduct(id, {
    storeId: store.id,
    name: "Hair Serum",
    slug: "hair-serum",
    status: "active",
  });
  await service.createOffer(id, {
    productId: product.id,
    storeMarketId: market.id,
    price: "3990",
  });
  await ops.savePageDraft(id, product.id, defaultPageConfig(product, []));
  await ops.publishPage(id, product.id);
  await service.publish(id, store.id, 0);
  for (let i = 0; i < 30; i++)
    await ops.checkout(store.slug, product.slug, crypto.randomUUID(), {
      market: "KE",
      name: "Profile Customer",
      phone: "0712345678",
      region: "Nairobi",
      city: "Nairobi",
      address: "12 Garden Road",
      quantity: 1,
    });
  await writeFile(fixturePath, JSON.stringify({ id, storeId: store.id }), {
    mode: 0o600,
  });
} else if (process.argv[2] === "migrate") {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../packages/db/drizzle", import.meta.url),
    ),
  });
  await seedCountries(db);
} else {
  const mode = process.argv[2],
    label = process.argv[3];
  if (
    !["dev", "production"].includes(mode) ||
    !/^[a-z0-9-]+$/.test(label ?? "")
  )
    throw new Error(
      "Use setup, migrate, or dev|production followed by a safe report label",
    );
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  let output = "",
    queryCount = 0;
  const server = spawn(
    "corepack",
    [
      "pnpm",
      "--filter",
      "@africacod/web",
      mode === "dev" ? "dev" : "start",
      ...(process.env.PROFILE_BUNDLER === "webpack" && mode === "dev"
        ? ["--webpack"]
        : []),
      "--port",
      "3200",
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: url.toString(),
        BETTER_AUTH_URL: "http://localhost:3200",
        APP_ENV: "staging",
        DATABASE_QUERY_PROFILE:
          process.env.PROFILE_QUERY_COUNT === "0" ? "0" : "1",
        PROVIDER_TEST_MODE: "0",
        TRACKING_TEST_MODE: "0",
      },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (d) => {
    output += String(d);
    queryCount += (String(d).match(/PROFILE_QUERY/g) || []).length;
  });
  server.stderr.on("data", (d) => (output += String(d)));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    for (let i = 0; i < 120; i++) {
      if (output.includes("Ready in")) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!output.includes("Ready in"))
      throw new Error(
        "Profiling server did not start; measurements discarded.",
      );
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(180000);
    page.setDefaultNavigationTimeout(180000);
    // Obtain a real signed session through the normal authentication API, rather than forging cookies.
    const email = `profile-${label}-${mode}-${Date.now()}@example.com`;
    const signup = await context.request.post(
      "http://localhost:3200/api/auth/sign-up/email",
      {
        timeout: 180000,
        data: {
          name: "Profiling Merchant",
          email,
          password: "Profile-password-2026!",
        },
      },
    );
    const result = await signup.json();
    // Attach this synthetic profiling user to the fixture workspace with a persisted Owner membership.
    const { memberships } = await import("../packages/db/src/index");
    const org = await new StoreSettingsService(db).organizationFor(fixture.id);
    await db.insert(memberships).values({
      organizationId: org!.id,
      userId: result.user.id,
      role: "owner",
      createdAt: new Date(0),
    });
    const routes = [
      "/dashboard",
      `/stores/${fixture.storeId}/settings`,
      "/products",
      "/orders",
      "/analytics",
      "/s/profiling-store?market=KE",
      "/s/profiling-store/p/hair-serum?market=KE",
    ];
    const results = [];
    for (const path of label.includes("soft")
      ? []
      : label.includes("extra") || label.includes("bundle")
        ? routes.slice(-1)
        : routes) {
      const started = performance.now();
      await page.goto(`http://localhost:3200${path}`);
      await page.locator("h1").first().waitFor();
      const cold = performance.now() - started;
      const warm = [];
      const counts = [];
      for (let i = 0; i < 5; i++) {
        const before = queryCount,
          t = performance.now();
        await page.goto(`http://localhost:3200${path}`);
        await page.locator("h1").first().waitFor();
        warm.push(Math.round(performance.now() - t));
        counts.push(queryCount - before);
      }
      console.info("Measured", path);
      const jsBytes = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter(
            (entry) =>
              entry.name.includes("/_next/") &&
              new URL(entry.name).pathname.endsWith(".js"),
          )
          .reduce(
            (sum, entry) =>
              sum + (entry as PerformanceResourceTiming).decodedBodySize,
            0,
          ),
      );
      results.push({
        jsBytes,
        path,
        coldMs: Math.round(cold),
        warmMs: warm,
        queries: counts,
      });
    }
    const checkout = [];
    for (let i = 0; i < 4; i++) {
      const t = performance.now();
      const response = await context.request.post(
        "http://localhost:3200/api/storefront/profiling-store/hair-serum/checkout",
        {
          timeout: 180000,
          headers: { "Idempotency-Key": crypto.randomUUID() },
          data: {
            market: "KE",
            name: "Profile Customer",
            phone: "0712345678",
            region: "Nairobi",
            city: "Nairobi",
            address: "12 Garden Road",
            quantity: 1,
          },
        },
      );
      if (!response.ok())
        throw new Error(`checkout status ${response.status()}`);
      checkout.push(Math.round(performance.now() - t));
    }
    results.push({ checkoutMs: checkout });
    await page.goto(`http://localhost:3200/stores/${fixture.storeId}/settings`);
    const saves = [];
    for (let i = 0; i < 5; i++) {
      await page
        .getByLabel("Hero Title", { exact: true })
        .fill(`Profile ${label} ${mode} ${i}`);
      const t = performance.now();
      await page
        .getByRole("button", { name: "Save Draft", exact: true })
        .click();
      await page
        .getByText("Draft saved. Your public Store is unchanged.", {
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("button", { name: "Save Draft", exact: true })
        .waitFor();
      saves.push(Math.round(performance.now() - t));
    }
    results.push({ saveDraftMs: saves });
    const soft = [];
    for (const [target, source] of label.includes("webpack") ||
    label.includes("extra") ||
    label.includes("bundle")
      ? []
      : [
          ["/dashboard", "/orders"],
          [`/stores/${fixture.storeId}/settings`, `/stores/${fixture.storeId}`],
          ["/orders", "/dashboard"],
          [
            "/s/profiling-store?market=KE",
            "/s/profiling-store/p/hair-serum?market=KE",
          ],
          [
            "/s/profiling-store/p/hair-serum?market=KE",
            "/s/profiling-store?market=KE",
          ],
        ]) {
      const samples = [];
      for (let i = 0; i < 5; i++) {
        await page.goto(`http://localhost:3200${source}`);
        await page.locator("h1").first().waitFor();
        const origin = await page.evaluate(() => performance.timeOrigin);
        const t = performance.now();
        await page.locator(`a[href="${target}"]`).first().click();
        await page.waitForURL(`http://localhost:3200${target}`);
        await page.locator("h1").first().waitFor();
        samples.push({
          ms: Math.round(performance.now() - t),
          sameDocument:
            origin === (await page.evaluate(() => performance.timeOrigin)),
        });
      }
      soft.push({ target, samples });
    }
    results.push({ softNavigation: soft });
    await writeFile(
      `/tmp/africacod-profile-${label}-${mode}.json`,
      JSON.stringify(results, null, 2),
    );
    console.info(JSON.stringify(results));
  } finally {
    await browser?.close();
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
    try {
      process.kill(-server.pid!, "SIGKILL");
    } catch {}
    await writeFile(`/tmp/africacod-profile-${label}-${mode}.log`, output);
  }
}
await client.end();
