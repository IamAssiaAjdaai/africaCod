import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    env: { APP_ENV: "test", CONSENT_MODE: "merchant-managed" },
    include: ["packages/*/src/**/*.test.ts", "apps/web/src/lib/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    environment: "node",
  },
});
