"use client";
import { useActionState, useState } from "react";
import { operationAction } from "@/lib/operation-actions";
export function OperationForm({
  orderId,
  intent,
  label,
  children,
  anchor,
  appearance = "primary",
}: {
  orderId: string;
  intent: string;
  label: string;
  children?: React.ReactNode;
  anchor?: string;
  appearance?: "primary" | "secondary";
}) {
  const [state, action, pending] = useActionState(operationAction, {});
  const [initialKey] = useState(() => crypto.randomUUID());
  return (
    <form
      id={anchor}
      action={action}
      aria-label={label}
      className="operation-form"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="intent" value={intent} />
      <input
        type="hidden"
        name="requestKey"
        value={state.requestKey ?? initialKey}
      />
      {children}
      <button
        className={`button ${intent === "cancel" ? "button-danger" : appearance === "secondary" ? "button-outline" : "button-green"}`}
        disabled={pending}
      >
        {pending ? "Recording…" : label}
      </button>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="success-note" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}
