import { withRateLimit } from "@/lib/rate-limit";
import { boundedText, BodyTooLarge } from "@/lib/request-body";
import { cookies } from "next/headers";
import { readConsent, consentCookieName } from "@/lib/consent";
import { NextResponse } from "next/server";
import { tracking } from "@/lib/server";
async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ storeSlug: string; productSlug: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { storeSlug, productSlug } = await params;
  if (
    !readConsent(
      storeSlug,
      (await cookies()).get(consentCookieName(storeSlug))?.value,
    ).analytics
  )
    return Response.json({ ok: true }, { status: 202 });
  try {
    const raw = await boundedText(request, 500);
    if (raw.length > 500)
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const body = JSON.parse(raw);
    await tracking().recordProductView(
      storeSlug,
      productSlug,
      body.market,
      body.eventId,
    );
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BodyTooLarge)
      return Response.json(
        { error: "Request too large." },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.json({ error: "View unavailable." }, { status: 400 });
  }
}

export const runtime = "nodejs";
export const POST = withRateLimit("observation", handlePOST);
