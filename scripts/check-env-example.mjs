import { readFileSync } from "node:fs";

// Validate the committed *example*, never print environment variable values.
const content = readFileSync(".env.example", "utf8");
const values = new Map();

for (const line of content.split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match) values.set(match[1], match[2].trim());
}

const sensitive = new Set([
  "BETTER_AUTH_SECRET",
  "PROVIDER_CREDENTIALS_KEY",
  "INTEGRATION_CREDENTIALS_KEY",
  "RATE_LIMIT_KEY",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "GOOGLE_CLIENT_SECRET",
]);

const errors = [];
for (const [name, value] of values) {
  const genericSecret = /(?:_SECRET|_TOKEN|_PASSWORD|_API_KEY)$/.test(name);
  if ((sensitive.has(name) || genericSecret) && value !== "") {
    errors.push(name + " must be empty in .env.example");
  }
}

for (const name of ["DATABASE_URL", "TEST_DATABASE_URL", "BETTER_AUTH_URL"]) {
  const value = values.get(name);
  if (!value) {
    errors.push(name + " is missing");
    continue;
  }

  try {
    const parsed = new URL(value);
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
      errors.push(name + " must point to a local-only example service");
    }
  } catch {
    errors.push(name + " must be a valid URL");
  }
}

if (errors.length) {
  console.error("Unsafe committed example environment configuration:");
  for (const error of errors) console.error("- " + error);
  process.exitCode = 1;
} else {
  console.log(
    "Environment template is local-only and has no populated known secret fields.",
  );
}
