import "server-only";
import { DomainError } from "@africacod/domain";
import { ZodError } from "zod";
import { logEvent } from "@africacod/shared";
import { optimizedImage } from "./image-processing";
import { mediaStorage } from "./media-storage";
export async function storeAssetResponse(
  request: Request,
  resolve: () => Promise<{ storageKey: string }>,
) {
  try {
    const asset = await resolve();
    const width = Number(new URL(request.url).searchParams.get("w") ?? "640");
    if (![320, 640, 960, 1600].includes(width))
      return new Response("Invalid size", { status: 400 });
    const bytes = await optimizedImage(mediaStorage(), asset.storageKey, width);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof DomainError || error instanceof ZodError)
      return new Response("Not found", { status: 404 });
    logEvent("error", "store_asset.delivery_failed");
    return new Response("Image temporarily unavailable", { status: 503 });
  }
}
