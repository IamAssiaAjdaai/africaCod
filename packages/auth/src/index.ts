import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDatabase, ensureInitialWorkspace } from "@africacod/db";
import * as schema from "@africacod/db/schema";
import { getAuthEnvironment, logEvent } from "@africacod/shared";
export function createAuth() {
  const env = getAuthEnvironment();
  return betterAuth({
    appName: "AfricaCod",
    logger: { level: "error", log: () => logEvent("error", "auth.failed") },
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDatabase(), { provider: "pg", schema }),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await ensureInitialWorkspace(getDatabase(), user.id);
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    trustedOrigins: [env.BETTER_AUTH_URL],
    advanced: {
      useSecureCookies: new URL(env.BETTER_AUTH_URL).protocol === "https:",
    },
    rateLimit: { enabled: true, window: 60, max: 60 },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  instance ??= createAuth();
  return instance;
}
