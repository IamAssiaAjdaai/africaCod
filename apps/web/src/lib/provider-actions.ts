"use server";
import { revalidatePath } from "next/cache";
import { DomainError } from "@africacod/domain";
import { ZodError } from "zod";
import { providers, requireSession } from "./server";
export async function providerAction(
  _state: { error?: string; success?: string },
  data: FormData,
): Promise<{ error?: string; success?: string }> {
  const { user } = await requireSession();
  try {
    const service = providers(),
      intent = data.get("intent"),
      id = String(data.get("connectionId") ?? "");
    if (intent === "configure")
      await service.configure(user.id, String(data.get("storeId")), {
        apiKey: data.get("apiKey") || undefined,
        apiSecret: data.get("apiSecret") || undefined,
        marketIds: data.getAll("marketId"),
        sourceTracking: data.get("sourceTracking") === "on",
        mockFailOnce: data.get("mockFailOnce") === "on",
      });
    else if (intent === "test") await service.testConnection(user.id, id);
    else if (intent === "disconnect") await service.disconnect(user.id, id);
    else if (intent === "mapping")
      await service.saveMapping(user.id, id, {
        productId: data.get("productId"),
        variantId: data.get("variantId") || null,
        providerProductId: data.get("providerProductId") || null,
        providerSku: data.get("providerSku") || null,
      });
    else throw new DomainError("INVALID_INPUT", "Unknown provider operation.");
    revalidatePath("/apps/shipcod");
    revalidatePath("/apps");
    return {
      success:
        intent === "test"
          ? "Connection check queued. Refresh after the worker processes it."
          : "Configuration saved.",
    };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof ZodError) return { error: "Check the provider form." };
    console.error("Provider configuration failed; credentials omitted.");
    return {
      error:
        "Could not save provider configuration. Check the server encryption key and retry.",
    };
  }
}
