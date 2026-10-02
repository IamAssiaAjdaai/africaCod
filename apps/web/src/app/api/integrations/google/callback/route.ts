import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleSheets, requireSession } from "@/lib/server";
export async function GET(request: Request) {
  const { user } = await requireSession();
  const params = new URL(request.url).searchParams;
  const cookie = (await cookies()).get("ac_google_state")?.value ?? "";
  try {
    const storeId = await googleSheets().finish(
      user.id,
      params.get("state") ?? "",
      cookie,
      params.get("code") ?? "",
    );
    const response = NextResponse.redirect(
      new URL(`/apps/google-sheets?storeId=${storeId}`, request.url),
    );
    response.cookies.set("ac_google_state", "", {
      path: "/api/integrations/google/callback",
      maxAge: 0,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    const response = NextResponse.json(
      {
        error:
          "Authorization was not completed. Return to Apps and connect again.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
    response.cookies.set("ac_google_state", "", {
      path: "/api/integrations/google/callback",
      maxAge: 0,
    });
    return response;
  }
}
