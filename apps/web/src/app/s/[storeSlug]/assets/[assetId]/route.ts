import { storeSettings } from "@/lib/server";
import { withRateLimit } from "@/lib/rate-limit";
import { storeAssetResponse } from "@/lib/store-asset-response";
export const runtime = "nodejs";
export const GET = withRateLimit(
  "media",
  async (
    request: Request,
    { params }: { params: Promise<{ storeSlug: string; assetId: string }> },
  ) => {
    const { storeSlug, assetId } = await params;
    return storeAssetResponse(request, () =>
      storeSettings().publicAsset(storeSlug, assetId),
    );
  },
);
