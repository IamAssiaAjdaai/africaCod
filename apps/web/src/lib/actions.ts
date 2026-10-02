"use server";
import { logEvent } from "@africacod/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { DomainError } from "@africacod/domain";
import { commerce, requireSession } from "./server";
export type FormState = { error?: string; success?: string };
function errorState(error: unknown): FormState {
  if (error instanceof DomainError) return { error: error.message };
  if (error instanceof ZodError)
    return {
      error: error.issues[0]?.message ?? "Check the form and try again.",
    };
  logEvent("error", "commerce_action_failed");
  return { error: "Something went wrong. Please try again." };
}
export async function createOrganizationAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  try {
    await commerce().createOrganization(user.id, { name: data.get("name") });
  } catch (error) {
    return errorState(error);
  }
  redirect("/stores");
}
export async function createStoreAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  let store;
  try {
    store = await commerce().createStore(user.id, {
      name: data.get("name"),
      slug: data.get("slug"),
    });
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/stores");
  redirect(`/stores/${store.id}`);
}
export async function addMarketAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  try {
    const market = await commerce().addMarket(user.id, {
      storeId: data.get("storeId"),
      countryCode: data.get("countryCode"),
    });
    revalidatePath(`/stores/${market.storeId}`);
    revalidatePath("/dashboard");
    return { success: "Market added." };
  } catch (error) {
    return errorState(error);
  }
}
export async function setMarketStatusAction(
  _state: FormState,
  data: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  try {
    const market = await commerce().setMarketStatus(user.id, {
      storeId: data.get("storeId"),
      marketId: data.get("marketId"),
      status: data.get("status"),
    });
    revalidatePath(`/stores/${market.storeId}`);
    revalidatePath("/dashboard");
    return {
      success:
        market.status === "active"
          ? "Market activated."
          : "Market deactivated.",
    };
  } catch (error) {
    return errorState(error);
  }
}
