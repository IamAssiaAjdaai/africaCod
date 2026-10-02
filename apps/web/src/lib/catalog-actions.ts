"use server";
import { logEvent } from "@africacod/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { DomainError, maxImageBytes } from "@africacod/domain";
import { catalog, requireSession } from "./server";
import { normalizedImage } from "./image-processing";
import { mediaStorage } from "./media-storage";
import type { FormState } from "./actions";
function failure(error: unknown): FormState {
  if (error instanceof DomainError) return { error: error.message };
  if (error instanceof ZodError)
    return { error: error.issues[0]?.message ?? "Check the form." };
  logEvent("error", "catalog_action_failed");
  return { error: "Something went wrong. Please try again." };
}
function refresh(productId?: string) {
  revalidatePath("/products");
  revalidatePath("/categories");
  revalidatePath("/dashboard");
  if (productId) revalidatePath(`/products/${productId}`);
}
const nullable = (data: FormData, name: string) => data.get(name) || null;
export async function saveCategoryAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  let category;
  try {
    const value = {
      storeId: data.get("storeId"),
      name: data.get("name"),
      slug: data.get("slug"),
      parentId: nullable(data, "parentId"),
      status: data.get("status"),
      sortOrder: Number(data.get("sortOrder")),
    };
    const id = data.get("categoryId");
    category = id
      ? await catalog().updateCategory(user.id, String(id), value)
      : await catalog().createCategory(user.id, value);
  } catch (error) {
    return failure(error);
  }
  refresh();
  redirect(`/categories/${category.id}`);
}
export async function saveProductAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  let product;
  try {
    const value = {
      storeId: data.get("storeId"),
      name: data.get("name"),
      slug: data.get("slug"),
      sku: nullable(data, "sku"),
      shortDescription: nullable(data, "shortDescription"),
      description: nullable(data, "description"),
      categoryId: nullable(data, "categoryId"),
      subcategoryId: nullable(data, "subcategoryId"),
      status: data.get("status"),
    };
    const id = data.get("productId");
    product = id
      ? await catalog().updateProduct(user.id, String(id), value)
      : await catalog().createProduct(user.id, value);
  } catch (error) {
    return failure(error);
  }
  refresh(product.id);
  if (!data.get("productId")) redirect(`/products/${product.id}`);
  return { success: "Product saved. Market offers are unchanged." };
}
export async function saveOfferAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  try {
    const value = {
      productId: data.get("productId"),
      storeMarketId: data.get("storeMarketId"),
      price: data.get("price"),
      compareAtPrice: nullable(data, "compareAtPrice"),
      cost: nullable(data, "cost"),
      status: data.get("status"),
    };
    const id = data.get("offerId");
    const offer = id
      ? await catalog().updateOffer(user.id, String(id), value)
      : await catalog().createOffer(user.id, value);
    refresh(offer.productId);
    return { success: "Offer saved." };
  } catch (error) {
    return failure(error);
  }
}
export async function saveVariantAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  try {
    const value = {
      productId: data.get("productId"),
      name: data.get("name"),
      sku: nullable(data, "sku"),
      status: data.get("status"),
      sortOrder: Number(data.get("sortOrder")),
    };
    const id = data.get("variantId");
    const variant = id
      ? await catalog().updateVariant(user.id, String(id), value)
      : await catalog().createVariant(user.id, value);
    refresh(variant.productId);
    return { success: "Variant saved." };
  } catch (error) {
    return failure(error);
  }
}
export async function uploadMediaAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  try {
    const file = data.get("image");
    if (!(file instanceof File) || !file.size || file.size > maxImageBytes)
      return { error: "Choose an image up to 10 MB." };
    const media = await catalog().uploadMedia(
      user.id,
      { productId: data.get("productId"), altText: nullable(data, "altText") },
      await normalizedImage(
        new Uint8Array(await file.arrayBuffer()),
        file.type,
      ),
      file.type,
      mediaStorage(),
    );
    refresh(media.productId);
    return { success: "Image uploaded." };
  } catch (error) {
    return failure(error);
  }
}
export async function removeMediaAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  try {
    const media = await catalog().getMedia(
      user.id,
      String(data.get("mediaId")),
    );
    await catalog().removeMedia(user.id, media.id, mediaStorage());
    refresh(media.productId);
    return { success: "Image removed." };
  } catch (error) {
    return failure(error);
  }
}
export async function reorderMediaAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  try {
    const productId = String(data.get("productId"));
    await catalog().reorderMedia(user.id, {
      productId,
      ids: data.getAll("mediaId"),
    });
    refresh(productId);
    return { success: "Image order saved." };
  } catch (error) {
    return failure(error);
  }
}
