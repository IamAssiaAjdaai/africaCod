import { boundedText, BodyTooLarge } from "@/lib/request-body";
import { cookies } from "next/headers";
import { readConsent, consentCookieName } from "@/lib/consent";
import { NextResponse } from "next/server";
import { visitors } from "@/lib/server";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeSlug: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const text = await boundedText(request, 500);
    if (text.length > 500)
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const { storeSlug } = await params;
    if (
      !readConsent(
        storeSlug,
        (await cookies()).get(consentCookieName(storeSlug))?.value,
      ).analytics
    )
      return Response.json({ ok: true }, { status: 202 });
    await visitors().capture(storeSlug, JSON.parse(text));
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
    return NextResponse.json(
      { error: "Observation unavailable." },
      { status: 400 },
    );
  }
}
