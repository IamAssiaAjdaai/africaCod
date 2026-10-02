import { describe, it, expect, vi } from "vitest";
import { validateRuntime, assertAdapterRuntime } from "./runtime";
import { logEvent, setErrorMonitor } from "./logging";
import { randomBytes } from "node:crypto";
const production = () => ({
  APP_ENV: "production",
  NODE_ENV: "production",
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
});
describe("production environment", () => {
  it("accepts a complete production configuration", () =>
    expect(validateRuntime(production()).APP_ENV).toBe("production"));
  it.each(["PROVIDER_TEST_MODE", "TRACKING_TEST_MODE"])("rejects %s", (field) =>
    expect(() => validateRuntime({ ...production(), [field]: "1" })).toThrow(
      "forbidden",
    ),
  );
  it("rejects absent environment, local storage, insecure URLs and fixture keys", () => {
    for (const patch of [
      { APP_ENV: undefined },
      { MEDIA_STORAGE: "local" },
      { BETTER_AUTH_URL: "http://localhost:3000" },
      { DATABASE_URL: "postgresql://db/db" },
      {
        INTEGRATION_CREDENTIALS_KEY:
          "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      },
      { RATE_LIMIT_KEY: undefined },
      { S3_SECRET_ACCESS_KEY: "local-test" },
      { RATE_LIMIT_KEY: "replace-with-a-long-random-secret" },
    ])
      expect(() => validateRuntime({ ...production(), ...patch })).toThrow();
  });
  it("never includes invalid secret values in validation errors", () => {
    try {
      validateRuntime({ ...production(), BETTER_AUTH_SECRET: "leaked-secret" });
    } catch (e) {
      expect(String(e)).not.toContain("leaked-secret");
    }
  });
  it("allows explicitly isolated staging mocks", () =>
    expect(
      validateRuntime({
        ...production(),
        APP_ENV: "staging",
        TRACKING_TEST_MODE: "1",
        PROVIDER_TEST_MODE: "1",
        MEDIA_STORAGE: "local",
      }).TRACKING_TEST_MODE,
    ).toBe("1"));
});
it("logs only allowlisted safe context; monitoring failure cannot fail an operation", () => {
  const output = vi.spyOn(console, "error").mockImplementation(() => {});
  setErrorMonitor(() => {
    throw new Error("monitor-secret");
  });
  logEvent("error", "checkout.failed", {
    orderId: "abc",
    password: "secret",
    code: "invalid value secret",
  } as never);
  const value = JSON.parse(output.mock.calls[0][0]);
  expect(value.orderId).toBe("abc");
  expect(value.password).toBeUndefined();
  expect(value.code).toBeUndefined();
  output.mockRestore();
});

it("rejects deterministic adapters at the service boundary in production", () => {
  vi.stubEnv("APP_ENV", "production");
  try {
    expect(() => assertAdapterRuntime(true)).toThrow("forbidden");
    expect(() => assertAdapterRuntime(false)).not.toThrow();
  } finally {
    vi.unstubAllEnvs();
  }
});
