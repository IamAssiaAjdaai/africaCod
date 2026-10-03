import "server-only";
import { headers } from "next/headers";
import { isIP } from "node:net";
import { getDatabase } from "@africacod/db";
import { AbuseService, abuseKey } from "@africacod/domain";
import { runtimeEnvironment, logEvent } from "@africacod/shared";
const budgets = {
  auth: 60,
  checkout: 30,
  observation: 180,
  media: 600,
  action: 120,
};
type Category = keyof typeof budgets;

async function checkRateLimit(
  category: Category,
  requestHeaders: Pick<Headers, "get" | "has">,
) {
  const requestId = requestHeaders.get("x-request-id") ?? undefined;
  const responseHeaders = {
    "Cache-Control": "no-store",
    ...(requestId ? { "X-Request-ID": requestId } : {}),
  };
  try {
    const env = runtimeEnvironment();
    const identity = env.CLIENT_IP_HEADER
      ? requestHeaders.get(env.CLIENT_IP_HEADER)
      : "local";
    if (env.APP_ENV === "production" && (!identity || !isIP(identity)))
      return Response.json(
        { error: "Service temporarily unavailable." },
        { status: 503, headers: responseHeaders },
      );
    const allowed = await new AbuseService(getDatabase()).consume(
      abuseKey(
        env.RATE_LIMIT_KEY ?? env.BETTER_AUTH_SECRET,
        category,
        identity ?? "local",
      ),
      budgets[category],
      60,
    );
    if (!allowed)
      return Response.json(
        { error: "Too many requests. Please wait a minute and try again." },
        { status: 429, headers: { ...responseHeaders, "Retry-After": "60" } },
      );
  } catch {
    logEvent("error", "abuse.unavailable", { requestId });
    return Response.json(
      { error: "Service temporarily unavailable." },
      { status: 503, headers: responseHeaders },
    );
  }
}

export function withRateLimit<Args extends unknown[]>(
  category: Category,
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args) => {
    const limited = await checkRateLimit(category, request.headers);
    return limited ?? handler(request, ...args);
  };
}

// Next.js returns the same sealed headers object for a request. Charge once even
// when an action re-renders layouts that also require a session. Weak keys expire
// with the request; a copied/replayed client request ID cannot bypass the budget.
const actionChecks = new WeakMap<object, ReturnType<typeof checkRateLimit>>();
export async function enforceActionRateLimit() {
  const requestHeaders = await headers();
  if (!requestHeaders.has("next-action")) return;
  let check = actionChecks.get(requestHeaders);
  if (!check) {
    check = checkRateLimit("action", requestHeaders);
    actionChecks.set(requestHeaders, check);
  }
  const limited = await check;
  if (limited)
    throw new Error(
      limited.status === 429
        ? "Too many requests. Please wait a minute and try again."
        : "Service temporarily unavailable.",
    );
}
