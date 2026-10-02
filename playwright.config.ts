import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 120000,
  expect: { timeout: 20000 },
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHROME_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHROME_CHANNEL }
          : {}),
      },
    },
  ],
  webServer: {
    command: "corepack pnpm --filter @africacod/web start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
