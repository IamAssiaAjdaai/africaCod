"use server";
import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import {
  DomainError,
  shipmentTransitions,
  fulfillmentTransitions,
} from "@africacod/domain";
import { operations, providers, requireSession } from "./server";
export type OperationState = {
  error?: string;
  success?: string;
  requestKey?: string;
};
export async function operationAction(
  _state: OperationState,
  data: FormData,
): Promise<OperationState> {
  const { user } = await requireSession();
  const orderId = String(data.get("orderId"));
  const intent = String(data.get("intent"));
  try {
    const service = operations();
    if (intent === "attempt")
      await service.recordAttempt(user.id, orderId, {
        outcome: data.get("outcome"),
        note: data.get("note") || null,
        nextCallbackAt: data.get("nextCallbackAt")
          ? `${data.get("nextCallbackAt")}Z`
          : null,
        reason: data.get("reason") || null,
        requestKey: data.get("requestKey"),
      });
    else if (intent === "assign")
      await service.assignOrder(
        user.id,
        orderId,
        data.get("agentId") ? String(data.get("agentId")) : null,
      );
    else if (intent === "fulfillment")
      await service.createFulfillment(user.id, orderId);
    else if (intent === "shipment")
      await service.createManualShipment(user.id, orderId, {
        trackingNumber: data.get("trackingNumber") || null,
        trackingUrl: data.get("trackingUrl") || null,
      });
    else if (intent === "shipment-transition")
      await service.transitionShipment(
        user.id,
        String(data.get("shipmentId")),
        z
          .enum(
            Object.keys(shipmentTransitions) as [
              keyof typeof shipmentTransitions,
              ...(keyof typeof shipmentTransitions)[],
            ],
          )
          .parse(data.get("target")),
      );
    else if (intent === "fulfillment-transition")
      await service.transitionFulfillment(
        user.id,
        orderId,
        z
          .enum(
            Object.keys(fulfillmentTransitions) as [
              keyof typeof fulfillmentTransitions,
              ...(keyof typeof fulfillmentTransitions)[],
            ],
          )
          .parse(data.get("target")),
      );
    else if (intent === "provider-send")
      await providers().requestHandoff(user.id, orderId);
    else if (intent === "provider-fallback")
      await providers().manualFallback(user.id, orderId);
    else if (intent === "provider-sync") {
      const detail = await providers().getOperations(user.id, orderId);
      if (detail.shipment)
        await providers().requestSync(user.id, detail.shipment.id);
    } else if (intent === "provider-simulate") {
      const detail = await providers().getOperations(user.id, orderId);
      if (detail.shipment)
        await providers().simulateStatus(
          user.id,
          detail.shipment.id,
          String(data.get("rawStatus")),
        );
    } else throw new DomainError("INVALID_INPUT", "Unknown operation.");
    for (const path of [
      `/orders/${orderId}`,
      "/orders",
      "/orders/confirmation",
      "/orders/callbacks",
      "/fulfillment",
      "/dashboard",
    ])
      revalidatePath(path);
    return { success: "Operation recorded.", requestKey: crypto.randomUUID() };
  } catch (error) {
    const requestKey = String(data.get("requestKey") ?? "");
    if (error instanceof DomainError)
      return { error: error.message, requestKey };
    if (error instanceof ZodError)
      return {
        error: error.issues[0]?.message ?? "Check the form.",
        requestKey,
      };
    console.error("Operation failed");
    return {
      error: "Could not record the operation. Please retry.",
      requestKey,
    };
  }
}
