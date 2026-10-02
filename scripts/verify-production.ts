import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  validateRuntime,
  getDatabaseEnvironment,
} from "../packages/shared/src/index";
const database = new URL(getDatabaseEnvironment().DATABASE_URL);
database.searchParams.set("sslmode", "require");
const env = {
  ...process.env,
  APP_ENV: "production",
  NODE_ENV: "production",
  DATABASE_URL: database.toString(),
  BETTER_AUTH_URL: "https://beta.invalid",
  BETTER_AUTH_SECRET: randomBytes(48).toString("base64"),
  PROVIDER_CREDENTIALS_KEY: randomBytes(32).toString("base64"),
  INTEGRATION_CREDENTIALS_KEY: randomBytes(32).toString("base64"),
  RATE_LIMIT_KEY: randomBytes(48).toString("base64"),
  CLIENT_IP_HEADER: "x-real-ip",
  MEDIA_STORAGE: "s3",
  S3_ENDPOINT: "https://storage.invalid",
  S3_BUCKET: "production-build-verification",
  S3_ACCESS_KEY_ID: randomBytes(20).toString("hex"),
  S3_SECRET_ACCESS_KEY: randomBytes(32).toString("base64"),
  PROVIDER_TEST_MODE: "0",
  TRACKING_TEST_MODE: "0",
  CONSENT_MODE: "required",
};
validateRuntime(env);
console.info(
  "Production configuration validated: random ephemeral keys, HTTPS/TLS required, both test adapters disabled. No live service activation is claimed.",
);
const child = spawn("corepack", ["pnpm", "build"], { env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
