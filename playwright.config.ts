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
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
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
    env: {
      APP_ENV: "staging",
      PORT: "3100",
      BETTER_AUTH_URL: "http://localhost:3100",
      CONSENT_MODE: "merchant-managed",
      TRACKING_TEST_MODE: "1",
      INTEGRATION_CREDENTIALS_KEY:
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      PROVIDER_TEST_MODE: "1",
      PROVIDER_CREDENTIALS_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    },
    command: "corepack pnpm --filter @africacod/web start",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
