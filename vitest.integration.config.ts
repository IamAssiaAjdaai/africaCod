import { loadRootEnvironment } from "./packages/shared/src/node.ts";
import { defineConfig } from "vitest/config";
if (process.env.APP_ENV === "production")
  throw new Error(
    "Integration tests are forbidden in a production environment.",
  );
loadRootEnvironment();
export default defineConfig({
  test: {
    env: { APP_ENV: "test", CONSENT_MODE: "merchant-managed" },
    setupFiles: ["./tests/integration-setup.ts"],
    include: ["packages/*/src/**/*.integration.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
