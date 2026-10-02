import { DomainError } from "@africacod/domain";
import { storefront } from "@/lib/server";
import { localMediaStorage } from "@/lib/local-media-storage";
export async function GET(
  _request: Request,
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
    const bytes = await localMediaStorage.read(media.storageKey);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": media.mimeType,
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
    throw error;
  }
}
