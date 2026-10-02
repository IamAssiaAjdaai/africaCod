import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./tests",
  testMatch: ["**/e2e/operations.spec.ts", "**/smoke/oauth.spec.ts"],
  webServer: {
    ...(base.webServer as object),
    command: "corepack pnpm --filter @africacod/web start",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: {
      APP_ENV: "staging",
      PORT: "3100",
      PROVIDER_TEST_MODE: "0",
      TRACKING_TEST_MODE: "0",
      CONSENT_MODE: "required",
    },
  },
});
