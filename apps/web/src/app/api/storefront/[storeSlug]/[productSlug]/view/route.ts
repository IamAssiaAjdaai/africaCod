import { NextResponse } from "next/server";
import { tracking } from "@/lib/server";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeSlug: string; productSlug: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { storeSlug, productSlug } = await params;
  try {
    const raw = await request.text();
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
  } catch {
    return NextResponse.json({ error: "View unavailable." }, { status: 400 });
  }
}
