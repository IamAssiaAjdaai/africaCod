"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { trackingProviders } from "@africacod/domain";
import { tracking, requireSession } from "./server";
export async function trackingAction(
  _state: { error?: string; success?: string },
  data: FormData,
): Promise<{ error?: string; success?: string }> {
  const { user } = await requireSession();
  try {
    await tracking().configureTracking(
      user.id,
      String(data.get("storeId")),
      z.enum(trackingProviders).parse(data.get("provider")),
      {
        enabled: data.get("enabled") === "on",
        pixelId: String(data.get("pixelId") ?? ""),
        token: String(data.get("token") ?? ""),
        purchaseMode: String(data.get("purchaseMode") ?? "disabled"),
        tagId: String(data.get("tagId") ?? ""),
        leadLabel: String(data.get("leadLabel") ?? ""),
        deliveredLabel: String(data.get("deliveredLabel") ?? ""),
        destination: String(data.get("destination") ?? ""),
      },
    );
    revalidatePath("/apps");
    return { success: "Settings saved." };
  } catch {
    return {
      error:
        "Could not save. Check account identifiers, destination and encryption configuration.",
    };
  }
}
