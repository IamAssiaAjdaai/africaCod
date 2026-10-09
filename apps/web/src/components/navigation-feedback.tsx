"use client";

import { useLinkStatus } from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return (
    <span className="navigation-feedback" role="status" aria-hidden={!pending}>
      <span className="sr-only">{pending ? "Opening page…" : ""}</span>
      {pending ? (
        <LoaderCircle
          size={16}
          className="navigation-spinner"
          aria-hidden="true"
        />
      ) : (
        <ArrowRight size={16} aria-hidden="true" />
      )}
    </span>
  );
}
