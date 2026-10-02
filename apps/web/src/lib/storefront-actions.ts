"use server";
import { revalidatePath } from "next/cache";
import { DomainError } from "@africacod/domain";
import { ZodError } from "zod";
import { storefront, requireSession } from "./server";
import type { FormState } from "./actions";
export async function pageAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  const id = String(data.get("productId"));
  try {
    const service = storefront();
    const intent = data.get("intent");
    if (intent === "publish") await service.publishPage(user.id, id);
    else if (intent === "unpublish") await service.unpublishPage(user.id, id);
    else
      await service.savePageDraft(user.id, id, {
        headline: data.get("headline"),
        subtitle: data.get("subtitle"),
        benefits: String(data.get("benefits") ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        trustMessage: data.get("trustMessage"),
        ctaLabel: data.get("ctaLabel"),
        mediaIds: data.getAll("mediaId"),
      });
    revalidatePath(`/products/${id}`);
    return {
      success:
        intent === "publish"
          ? "Storefront published."
          : intent === "unpublish"
            ? "Storefront unpublished."
            : "Draft saved. Publish to update the live page.",
    };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof ZodError)
      return { error: error.issues[0]?.message ?? "Check the form." };
    console.error("Storefront action failed", error);
    return { error: "Could not save. Please try again." };
  }
}
