import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
// Absolute path makes CLI, worker, and Next.js load the same root environment.
let directory = process.cwd();
while (
  !existsSync(join(directory, "pnpm-workspace.yaml")) &&
  dirname(directory) !== directory
)
  directory = dirname(directory);
if (
  process.env.APP_ENV !== "production" &&
  process.env.NODE_ENV !== "production"
)
  config({ path: join(directory, ".env"), quiet: true });
const databaseEnvironment = z.object({ DATABASE_URL: z.url() });
const authEnvironment = z.object({
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
});
export function getDatabaseEnvironment() {
  return databaseEnvironment.parse(process.env);
}
export function getAuthEnvironment() {
  return authEnvironment.parse(process.env);
}
export const defaultLocale = "en";
export {
  runtimeEnvironment,
  validateRuntime,
  assertAdapterRuntime,
} from "./runtime";
export { logEvent, setErrorMonitor } from "./logging";
