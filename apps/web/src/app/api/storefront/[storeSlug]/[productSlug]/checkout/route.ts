import { withRateLimit } from "@/lib/rate-limit";
import { boundedText } from "@/lib/request-body";
import { readConsent, consentCookieName } from "@/lib/consent";
import { logEvent } from "@africacod/shared";
import { DomainError } from "@africacod/domain";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { storefront } from "@/lib/server";
async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ storeSlug: string; productSlug: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json(
      { error: "Use JSON checkout details." },
      { status: 415 },
    );
  let raw: string;
  try {
    raw = await boundedText(request, 16384);
  } catch {
    return Response.json(
      { error: "Checkout details are too long." },
      { status: 413 },
    );
  }
  if (raw.length > 16384)
    return Response.json(
      { error: "Checkout details are too long." },
      { status: 413 },
    );
  const { storeSlug, productSlug } = await params;
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return Response.json(
      { error: "Invalid checkout details." },
      { status: 400 },
    );
  }
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const cookieStore = await cookies();
    const attribution =
      input.attribution &&
      typeof input.attribution === "object" &&
      !Array.isArray(input.attribution)
        ? input.attribution
        : {};
    input.attribution = {
      ...attribution,
      marketingConsent: readConsent(
        storeSlug,
        cookieStore.get(consentCookieName(storeSlug))?.value,
      ).marketing,
      fbp: cookieStore.get("_fbp")?.value ?? attribution.fbp ?? null,
      fbc: cookieStore.get("_fbc")?.value ?? attribution.fbc ?? null,
    };
  }
  try {
    const result = await storefront().checkout(
      storeSlug,
      productSlug,
      request.headers.get("Idempotency-Key") ?? "",
      input,
      request.headers.get("user-agent"),
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError)
      return Response.json(
        { error: error.issues[0]?.message ?? "Check your delivery details." },
        { status: 400 },
      );
    if (error instanceof DomainError)
      return Response.json(
        { error: error.message },
        {
          status:
            error.code === "NOT_FOUND"
              ? 404
              : error.code === "CONFLICT"
                ? 409
                : 400,
        },
      );
    logEvent("error", "checkout_failed");
    return Response.json(
      { error: "Could not place your order. Retry with the same details." },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const POST = withRateLimit("checkout", handlePOST);
