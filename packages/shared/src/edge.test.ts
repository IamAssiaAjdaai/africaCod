import { it, expect } from "vitest";
import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { randomBytes, webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
const production = {
  APP_ENV: "production",
  NODE_ENV: "production",
  NEXT_RUNTIME: "edge",
  DATABASE_URL: "postgresql://user:password@db.example/db?sslmode=require",
  BETTER_AUTH_URL: "https://beta.example",
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  PROVIDER_CREDENTIALS_KEY: randomBytes(32).toString("base64"),
  INTEGRATION_CREDENTIALS_KEY: randomBytes(32).toString("base64"),
  RATE_LIMIT_KEY: randomBytes(32).toString("hex"),
  CLIENT_IP_HEADER: "x-real-ip",
  MEDIA_STORAGE: "s3",
  S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  S3_BUCKET: "media",
  S3_ACCESS_KEY_ID: randomBytes(20).toString("hex"),
  S3_SECRET_ACCESS_KEY: randomBytes(32).toString("hex"),
};
function edgeBundle(path: string) {
  // Browser bundling fails if a transitive import includes fs/path/crypto/dotenv.
  const result = buildSync({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "EdgeBoundary",
    external: ["next/server"],
    write: false,
  });
  expect(result.warnings).toEqual([]);
  const logs: string[] = [];
  const sandbox = {
    process: { env: production },
    Buffer: undefined,
    atob,
    URL,
    Headers,
    Response,
    crypto: webcrypto,
    console: {
      info: (value: string) => logs.push(value),
      error: (value: string) => logs.push(value),
    },
    require: (name: string) => {
      if (name !== "next/server")
        throw new Error(`Unexpected runtime dependency: ${name}`);
      return {
        NextResponse: {
          next: (options: { request: { headers: Headers } }) => ({
            headers: new Headers(),
            request: options.request,
          }),
        },
      };
    },
    EdgeBoundary: undefined as unknown,
  };
  runInNewContext(result.outputFiles[0].text, sandbox);
  return {
    api: sandbox.EdgeBoundary as Record<
      string,
      (...args: unknown[]) => unknown
    >,
    logs,
  };
}
it("shared imports bundle and validate production without Node globals or environment loading", () => {
  const { api } = edgeBundle("./index.ts");
  expect(api.validateRuntime(production)).toMatchObject({
    APP_ENV: "production",
  });
  expect(() =>
    api.validateRuntime({ ...production, PROVIDER_TEST_MODE: "1" }),
  ).toThrow("forbidden");
  expect(() =>
    api.validateRuntime({ ...production, APP_ENV: undefined }),
  ).toThrow("APP_ENV");
});
it("proxy bundles for Edge and replaces caller-supplied request IDs", () => {
  const { api } = edgeBundle("../../../apps/web/src/proxy.ts");
  const response = api.proxy({
    headers: new Headers({ "x-request-id": "spoofed" }),
  }) as { headers: Headers; request: { headers: Headers } };
  const id = response.headers.get("x-request-id");
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  expect(response.request.headers.get("x-request-id")).toBe(id);
});
it("Edge instrumentation bundles and logs safe errors without Node imports", async () => {
  const { api, logs } = edgeBundle("../../../apps/web/src/instrumentation.ts");
  await api.register();
  await api.onRequestError(
    new Error("secret-not-for-logs"),
    { headers: { "x-request-id": "safe-request" } },
    { routeType: "render" },
  );
  expect(logs).toHaveLength(1);
  expect(logs[0]).not.toContain("secret-not-for-logs");
  expect(JSON.parse(logs[0])).toMatchObject({
    event: "request.failed",
    requestId: "safe-request",
  });
});
