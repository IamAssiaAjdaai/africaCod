import { z } from "zod";
const key = z.string().regex(/^[A-Za-z0-9+/]{43}=$/);
const shape = z.object({
  APP_ENV: z.enum(["development", "test", "staging", "production"]),
  DATABASE_URL: z.url(),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  PROVIDER_TEST_MODE: z.enum(["0", "1"]).default("0"),
  TRACKING_TEST_MODE: z.enum(["0", "1"]).default("0"),
  PROVIDER_CREDENTIALS_KEY: key.optional(),
  INTEGRATION_CREDENTIALS_KEY: key.optional(),
  RATE_LIMIT_KEY: z.string().min(32).optional(),
  CLIENT_IP_HEADER: z.enum(["x-real-ip", "cf-connecting-ip"]).optional(),
  MEDIA_STORAGE: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().min(3).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  CONSENT_MODE: z.enum(["required", "merchant-managed"]).default("required"),
});
export function validateRuntime(source: Record<string, string | undefined>) {
  const values = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== ""),
  );
  const parsed = shape.safeParse({
    ...values,
    APP_ENV:
      values.APP_ENV ??
      (values.NODE_ENV === "production" ? undefined : "development"),
  });
  if (!parsed.success)
    throw new Error(
      `Invalid runtime configuration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  const env = parsed.data;
  if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_CLIENT_SECRET)
    throw new Error("Google OAuth configuration incomplete.");
  if (
    env.MEDIA_STORAGE === "s3" &&
    [
      env.S3_ENDPOINT,
      env.S3_BUCKET,
      env.S3_ACCESS_KEY_ID,
      env.S3_SECRET_ACCESS_KEY,
    ].some((v) => !v)
  )
    throw new Error("S3 media configuration incomplete.");
  if (env.APP_ENV === "production") {
    if (env.PROVIDER_TEST_MODE === "1" || env.TRACKING_TEST_MODE === "1")
      throw new Error("Test adapters are forbidden in production.");
    if (env.MEDIA_STORAGE !== "s3")
      throw new Error("Production requires private S3 media storage.");
    if (
      !env.RATE_LIMIT_KEY ||
      !env.CLIENT_IP_HEADER ||
      !env.INTEGRATION_CREDENTIALS_KEY ||
      !env.PROVIDER_CREDENTIALS_KEY
    )
      throw new Error("Production security configuration incomplete.");
    if (
      new URL(env.BETTER_AUTH_URL).protocol !== "https:" ||
      new URL(env.S3_ENDPOINT!).protocol !== "https:"
    )
      throw new Error("Production endpoints must use HTTPS.");
    if (
      !/[?&]sslmode=(require|verify-full|verify-ca)(?:&|$)/.test(
        env.DATABASE_URL,
      )
    )
      throw new Error("Production database must require TLS.");
    const placeholders =
      /^(replace|example|test|local|development|dummy|changeme)(?:[-_ ]|$)/i;
    if (
      [
        env.BETTER_AUTH_SECRET,
        env.RATE_LIMIT_KEY!,
        env.S3_ACCESS_KEY_ID!,
        env.S3_SECRET_ACCESS_KEY!,
        env.GOOGLE_CLIENT_SECRET,
      ]
        .filter(Boolean)
        .some((value) => placeholders.test(value!)) ||
      env.S3_ACCESS_KEY_ID!.length < 10 ||
      env.S3_SECRET_ACCESS_KEY!.length < 16 ||
      (env.GOOGLE_CLIENT_SECRET !== undefined &&
        env.GOOGLE_CLIENT_SECRET.length < 16) ||
      env.PROVIDER_CREDENTIALS_KEY === env.INTEGRATION_CREDENTIALS_KEY ||
      [env.INTEGRATION_CREDENTIALS_KEY, env.PROVIDER_CREDENTIALS_KEY].some(
        (v) => new Set(atob(v!)).size < 8,
      )
    )
      throw new Error("Production secrets must be independently generated.");
  }
  return env;
}
export function runtimeEnvironment() {
  return validateRuntime(process.env);
}
export function assertAdapterRuntime(testMode: boolean) {
  if (process.env.APP_ENV === "production" && testMode)
    throw new Error("Test adapters are forbidden in production.");
}
