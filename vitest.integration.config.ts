import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.integration.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20000,
  },
});
