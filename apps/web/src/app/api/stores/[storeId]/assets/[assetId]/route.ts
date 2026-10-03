import { readSession, storeSettings } from "@/lib/server";
import { withRateLimit } from "@/lib/rate-limit";
import { storeAssetResponse } from "@/lib/store-asset-response";
export const runtime = "nodejs";
export const GET = withRateLimit(
  "media",
  async (
    request: Request,
    { params }: { params: Promise<{ storeId: string; assetId: string }> },
  ) => {
    const session = await readSession();
    if (!session) return new Response("Not found", { status: 404 });
    const { storeId, assetId } = await params;
    return storeAssetResponse(request, () =>
      storeSettings().privateAsset(session.user.id, storeId, assetId),
    );
  },
);
