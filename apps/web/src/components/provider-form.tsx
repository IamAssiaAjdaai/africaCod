"use client";
import { useActionState } from "react";
import { providerAction } from "@/lib/provider-actions";
export function ProviderForm({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(providerAction, {});
  return (
    <form
      action={action}
      className="stack-form catalog-form"
      aria-label={label}
    >
      {children}
      <button className="button button-green" disabled={pending}>
        {pending ? "Saving…" : label}
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
