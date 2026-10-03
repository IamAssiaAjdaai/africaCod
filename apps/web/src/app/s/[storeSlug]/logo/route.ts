import { withRateLimit } from "@/lib/rate-limit";
import { optimizedImage } from "@/lib/image-processing";
import { logEvent } from "@africacod/shared";
import { DomainError } from "@africacod/domain";
import { site } from "@/lib/server";
import { mediaStorage } from "@/lib/media-storage";
async function handleGET(
  request: Request,
  { params }: { params: Promise<{ storeSlug: string }> },
) {
  try {
    const { storeSlug } = await params;
    const logo = await site().getPublicLogo(storeSlug);
    const width = Number(new URL(request.url).searchParams.get("w") ?? "960");
    if (![320, 640, 960, 1600].includes(width))
      return new Response("Invalid size", { status: 400 });
    const bytes = await optimizedImage(mediaStorage(), logo.storageKey, width);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (
      error instanceof DomainError ||
      (error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT")
    )
      return new Response("Not found", { status: 404 });
    logEvent("error", "media.delivery_failed");
    return new Response("Media temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export const runtime = "nodejs";
export const GET = withRateLimit("media", handleGET);
