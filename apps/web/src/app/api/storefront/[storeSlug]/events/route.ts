import { NextResponse } from "next/server";
import { visitors } from "@/lib/server";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeSlug: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 500)
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const { storeSlug } = await params;
    await visitors().capture(storeSlug, JSON.parse(text));
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Observation unavailable." },
      { status: 400 },
    );
  }
}
