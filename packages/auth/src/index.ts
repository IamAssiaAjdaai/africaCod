import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDatabase } from "@africacod/db";
import * as schema from "@africacod/db/schema";
import { getAuthEnvironment } from "@africacod/shared";
export function createAuth() {
  const env = getAuthEnvironment();
  return betterAuth({
    appName: "AfricaCod",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDatabase(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    trustedOrigins: [env.BETTER_AUTH_URL],
    rateLimit: { enabled: true, window: 60, max: 60 },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  instance ??= createAuth();
  return instance;
}
