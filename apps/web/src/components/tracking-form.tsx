"use client";
import { useActionState } from "react";
import { trackingAction } from "@/lib/tracking-actions";
export function TrackingForm({ children }: { children: React.ReactNode }) {
  const [state, action, pending] = useActionState(trackingAction, {});
  return (
    <form action={action} className="stack-form catalog-form">
      {children}
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
      <button className="button button-green" disabled={pending}>
        {pending ? "Saving…" : "Save tracking settings"}
      </button>
    </form>
  );
}
