"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, maxImageBytes } from "@africacod/domain";
import { ZodError } from "zod";
import { site, requireSession } from "./server";
import { localMediaStorage } from "./local-media-storage";
import type { FormState } from "./actions";
function failure(error: unknown): FormState {
  if (error instanceof DomainError) return { error: error.message };
  if (error instanceof ZodError)
    return { error: error.issues[0]?.message ?? "Check the form." };
  console.error("Content action failed", error);
  return { error: "Could not save. Please try again." };
}
export async function contentAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  const id = data.get("pageId") ? String(data.get("pageId")) : null;
  const intent = data.get("intent");
  let page;
  try {
    const service = site();
    if (intent === "publish" && id) {
      page = await service.publishContentPage(user.id, id);
    } else if (intent === "unpublish" && id) {
      await service.unpublishContentPage(user.id, id);
      page = await service.getContentPage(user.id, id);
    } else {
      page = await service.saveContentPage(user.id, id, {
        storeId: data.get("storeId"),
        title: data.get("title"),
        slug: data.get("slug"),
        content: data.get("content"),
        metaTitle: data.get("metaTitle") || null,
        metaDescription: data.get("metaDescription") || null,
        showInNavigation: data.get("showInNavigation") === "on",
        navigationLabel: data.get("navigationLabel") || null,
        navigationOrder: Number(data.get("navigationOrder") || 0),
      });
    }
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/pages");
  revalidatePath(`/pages/${page.id}`);
  if (!id) redirect(`/pages/${page.id}`);
  return {
    success:
      intent === "publish"
        ? "Page published."
        : intent === "unpublish"
          ? "Page unpublished."
          : "Draft saved. Publish to update the public page.",
  };
}
export async function brandingAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  const storeId = String(data.get("storeId"));
  try {
    await site().updateBranding(user.id, storeId, {
      name: data.get("name"),
      tagline: data.get("tagline") || null,
      contactEmail: data.get("contactEmail") || null,
      contactPhone: data.get("contactPhone") || null,
    });
    revalidatePath(`/stores/${storeId}`);
    revalidatePath("/stores");
    return { success: "Store branding saved." };
  } catch (error) {
    return failure(error);
  }
}
export async function logoAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  const storeId = String(data.get("storeId"));
  try {
    const file = data.get("logo");
    if (!(file instanceof File) || !file.size || file.size > maxImageBytes)
      return { error: "Choose a PNG, JPEG or WebP image up to 10 MB." };
    await site().uploadStoreLogo(
      user.id,
      storeId,
      new Uint8Array(await file.arrayBuffer()),
      file.type,
      localMediaStorage,
    );
    revalidatePath(`/stores/${storeId}`);
    return { success: "Logo saved." };
  } catch (error) {
    return failure(error);
  }
}
