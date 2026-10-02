import { boundedText } from "@/lib/request-body";
import { requireSession, googleSheets } from "@/lib/server";
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
    await googleSheets().disconnect(user.id, String(data.get("storeId")));
    return Response.redirect(new URL("/apps/google-sheets", request.url), 303);
  } catch {
    return Response.json(
      { error: "Could not disconnect. Please retry." },
      { status: 400 },
    );
  }
}
