import { boundedText } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { googleSheets, requireSession } from "@/lib/server";
import { runtimeEnvironment } from "@africacod/shared";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response("Invalid origin", { status: 403 });
  const { user } = await requireSession();
  try {
    const body = await boundedText(request, 16384);
    const data = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body,
    }).formData();
    const result = await googleSheets().begin(
      user.id,
      String(data.get("storeId")),
    );
    const response = NextResponse.redirect(result.url, 303);
    response.cookies.set("ac_google_state", result.state, {
      httpOnly: true,
      secure:
        new URL(runtimeEnvironment().BETTER_AUTH_URL).protocol === "https:",
      sameSite: "lax",
      path: "/api/integrations/google/callback",
      maxAge: 600,
    });
    return response;
  } catch {
    return Response.json(
      {
        error:
          "Google authorization unavailable. Check platform configuration.",
      },
      { status: 400 },
    );
  }
}
