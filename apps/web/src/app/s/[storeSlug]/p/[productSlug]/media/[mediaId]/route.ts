import { optimizedImage } from "@/lib/image-processing";
import { logEvent } from "@africacod/shared";
import { DomainError } from "@africacod/domain";
import { storefront } from "@/lib/server";
import { mediaStorage } from "@/lib/media-storage";
export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      storeSlug: string;
      productSlug: string;
      mediaId: string;
    }>;
  },
) {
  const { storeSlug, productSlug, mediaId } = await params;
  try {
    const media = await storefront().getPublicMedia(
      storeSlug,
      productSlug,
      mediaId,
    );
    const width = Number(new URL(request.url).searchParams.get("w") ?? "960");
    if (![320, 640, 960, 1600].includes(width))
      return new Response("Invalid size", { status: 400 });
    const bytes = await optimizedImage(mediaStorage(), media.storageKey, width);
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
