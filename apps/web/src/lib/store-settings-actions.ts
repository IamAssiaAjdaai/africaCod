"use server";
import { revalidatePath } from "next/cache";
import { DomainError, maxImageBytes } from "@africacod/domain";
import { ZodError } from "zod";
import { logEvent } from "@africacod/shared";
import { requireSession, storeSettings } from "./server";
import { normalizedImage } from "./image-processing";
import { mediaStorage } from "./media-storage";
function message(error: unknown) {
  if (error instanceof DomainError || error instanceof ZodError)
    return error instanceof ZodError
      ? (error.issues[0]?.message ?? "Check your settings.")
      : error.message;
  logEvent("error", "store_settings.failed");
  return "Could not save Store settings. Please try again.";
}
export async function saveStoreSettings(
  storeId: string,
  input: unknown,
  revision: number,
  publish = false,
) {
  const { user } = await requireSession();
  try {
    const service = storeSettings();
    const result = publish
      ? await service.publish(user.id, storeId, revision)
      : await service.saveDraft(user.id, storeId, input, revision);
    revalidatePath(`/stores/${storeId}`);
    revalidatePath("/s", "layout");
    return {
      success: publish
        ? "Store settings published."
        : "Draft saved. Your public Store is unchanged.",
      revision: result.revision,
      publishedRevision: result.publishedRevision,
      publishedAt: result.publishedAt?.toISOString() ?? null,
    };
  } catch (error) {
    return { error: message(error) };
  }
}
export async function uploadStoreAsset(data: FormData) {
  const { user } = await requireSession();
  try {
    const file = data.get("file");
    if (!(file instanceof File) || !file.size || file.size > maxImageBytes)
      return { error: "Choose a static PNG, JPEG or WebP up to 10 MB." };
    const asset = await storeSettings().uploadAsset(
      user.id,
      String(data.get("storeId")),
      await normalizedImage(
        new Uint8Array(await file.arrayBuffer()),
        file.type,
      ),
      file.type,
      mediaStorage(),
    );
    return { id: asset.id };
  } catch (error) {
    return { error: message(error) };
  }
}
