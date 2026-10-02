import { NextResponse, type NextRequest } from "next/server";
import { getDatabase } from "@africacod/db";
import { AbuseService, abuseKey } from "@africacod/domain";
import { runtimeEnvironment, logEvent } from "@africacod/shared";
import { isIP } from "node:net";
export async function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const forwarded = new Headers(request.headers);
  forwarded.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: forwarded } });
  response.headers.set("X-Request-ID", requestId);
  const path = request.nextUrl.pathname;
  const category =
    path.startsWith("/api/auth/") && request.method === "POST"
      ? "auth"
      : path.endsWith("/checkout")
        ? "checkout"
        : path.endsWith("/events") || path.endsWith("/view")
          ? "observation"
          : path.includes("/media/") || path.endsWith("/logo")
            ? "media"
            : request.headers.has("next-action") ||
                path.endsWith("/consent") ||
                (path.startsWith("/api/integrations/") &&
                  request.method === "POST")
              ? "action"
              : undefined;
  if (!category) return response;
  try {
    const env = runtimeEnvironment();
    const identity = env.CLIENT_IP_HEADER
      ? request.headers.get(env.CLIENT_IP_HEADER)
      : "local";
    if (env.APP_ENV === "production" && (!identity || !isIP(identity)))
      return NextResponse.json(
        { error: "Service temporarily unavailable." },
        { status: 503 },
      );
    const allowed = await new AbuseService(getDatabase()).consume(
      abuseKey(
        env.RATE_LIMIT_KEY ?? env.BETTER_AUTH_SECRET,
        category,
        identity ?? "local",
      ),
      { auth: 60, checkout: 30, observation: 180, media: 600, action: 120 }[
        category
      ],
      60,
    );
    if (!allowed)
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "Cache-Control": "no-store",
            "X-Request-ID": requestId,
          },
        },
      );
  } catch {
    logEvent("error", "abuse.unavailable", { requestId });
    return NextResponse.json(
      { error: "Service temporarily unavailable." },
      { status: 503 },
    );
  }
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
