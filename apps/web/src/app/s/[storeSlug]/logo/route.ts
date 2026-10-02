import { DomainError } from "@africacod/domain";
import { site } from "@/lib/server";
import { localMediaStorage } from "@/lib/local-media-storage";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeSlug: string }> },
) {
  try {
    const { storeSlug } = await params;
    const logo = await site().getPublicLogo(storeSlug);
    const bytes = await localMediaStorage.read(logo.storageKey);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": logo.mimeType,
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
