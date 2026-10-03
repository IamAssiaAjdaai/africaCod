import { loadRootEnvironment } from "../packages/shared/src/node";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { getDatabaseEnvironment } from "../packages/shared/src/index";
loadRootEnvironment();
const url = new URL(getDatabaseEnvironment().DATABASE_URL);
url.searchParams.set("sslmode", "require");
const env = {
  ...process.env,
  APP_ENV: "production",
  NODE_ENV: "production",
  DATABASE_URL: url.toString(),
  BETTER_AUTH_URL: "https://beta.invalid",
  BETTER_AUTH_SECRET: randomBytes(48).toString("base64"),
  PROVIDER_CREDENTIALS_KEY: randomBytes(32).toString("base64"),
  INTEGRATION_CREDENTIALS_KEY: randomBytes(32).toString("base64"),
  RATE_LIMIT_KEY: randomBytes(48).toString("base64"),
  CLIENT_IP_HEADER: "x-real-ip",
  MEDIA_STORAGE: "s3",
  S3_ENDPOINT: "https://storage.invalid",
  S3_BUCKET: "startup-verification",
  S3_ACCESS_KEY_ID: randomBytes(20).toString("hex"),
  S3_SECRET_ACCESS_KEY: randomBytes(32).toString("hex"),
  PROVIDER_TEST_MODE: "1",
  TRACKING_TEST_MODE: "0",
  CONSENT_MODE: "required",
};
async function rejectsStartup(
  configuration: NodeJS.ProcessEnv,
  expected: string,
) {
  const child = spawn(
    "corepack",
    ["pnpm", "--filter", "@africacod/web", "start", "--port", "3110"],
    { env: configuration, detached: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {}
      reject(
        new Error(
          "Production did not reject invalid configuration at startup.",
        ),
      );
    }, 25000);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && output.includes(expected)) resolve();
      else reject(new Error("Production startup rejection was not verified."));
    });
  });
}
await rejectsStartup(env, "Test adapters are forbidden in production");
const missingIdentity: NodeJS.ProcessEnv = { ...env, PROVIDER_TEST_MODE: "0" };
delete missingIdentity.APP_ENV;
await rejectsStartup(missingIdentity, "Invalid runtime configuration: APP_ENV");
console.info(
  "Actual production startup rejected mock adapters and missing APP_ENV before serving requests, without loading local development identity. Output/secrets were not exported.",
);
