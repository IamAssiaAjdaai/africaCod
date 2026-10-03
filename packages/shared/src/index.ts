import { z } from "zod";
// Side-effect-free, Edge-compatible exports. Node bootstraps load @africacod/shared/node explicitly.
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
