import { withRateLimit } from "@/lib/rate-limit";
import { boundedText } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runtimeEnvironment } from "@africacod/shared";
import { consentCookieName, encodeConsent } from "@/lib/consent";
async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ storeSlug: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response("Invalid origin", { status: 403 });
  try {
    const raw = await boundedText(request, 200);
    if (raw.length > 200) throw new Error();
    const value = z
      .object({ analytics: z.boolean(), marketing: z.boolean() })
      .strict()
      .parse(JSON.parse(raw));
    const { storeSlug } = await params;
    if (!/^[a-z0-9-]{3,63}$/.test(storeSlug)) throw new Error();
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(
      consentCookieName(storeSlug),
      encodeConsent(storeSlug, value.analytics, value.marketing),
      {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
        secure:
          new URL(runtimeEnvironment().BETTER_AUTH_URL).protocol === "https:",
        maxAge: 180 * 86400,
      },
    );
    if (!value.marketing) {
      for (const name of ["_fbp", "_fbc"])
        response.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
    return response;
  } catch {
    return Response.json(
      { error: "Could not save tracking preferences." },
      { status: 400 },
    );
  }
}

export const runtime = "nodejs";
export const POST = withRateLimit("action", handlePOST);
