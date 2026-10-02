import { DomainError } from "@africacod/domain";
import { logEvent } from "@africacod/shared";
import { z } from "zod";
import { catalog, readSession } from "@/lib/server";
import { mediaStorage } from "@/lib/media-storage";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  let session;
  try {
    session = await readSession();
  } catch {
    return new Response("Media temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { mediaId } = await params;
  if (!z.uuid().safeParse(mediaId).success)
    return new Response("Not found", { status: 404 });
  try {
    const media = await catalog().getMedia(session.user.id, mediaId);
    const bytes = await mediaStorage().read(media.storageKey);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": media.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    if (
      error instanceof DomainError &&
      ["NOT_FOUND", "ONBOARDING_REQUIRED"].includes(error.code)
    )
      return new Response("Not found", { status: 404 });
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return new Response("Not found", { status: 404 });
    logEvent("error", "media.private_unavailable");
    return new Response("Media temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
