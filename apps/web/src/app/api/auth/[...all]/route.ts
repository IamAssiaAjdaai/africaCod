import { withRateLimit } from "@/lib/rate-limit";
import { getAuth } from "@africacod/auth";
import { logEvent } from "@africacod/shared";
import { boundedText, BodyTooLarge } from "@/lib/request-body";
async function handle(request: Request) {
  try {
    return await getAuth().handler(request);
  } catch {
    logEvent("error", "auth.handler_unavailable");
    return Response.json(
      {
        message: "Authentication temporarily unavailable.",
        code: "AUTH_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export function GET(request: Request) {
  return handle(request);
}
async function handlePOST(request: Request) {
  let body: string;
  try {
    body = await boundedText(request, 16384);
  } catch (error) {
    return Response.json(
      { message: "Invalid authentication request." },
      {
        status: error instanceof BodyTooLarge ? 413 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  return handle(
    new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body,
    }),
  );
}

export const runtime = "nodejs";
export const POST = withRateLimit("auth", handlePOST);
