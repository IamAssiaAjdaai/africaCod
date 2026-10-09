import { ArrowUpRight, Layers3 } from "lucide-react";
import type { ReactNode } from "react";
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`brand ${dark ? "brand-dark" : ""}`}>
      <span className="brand-mark">
        <Layers3 size={22} aria-hidden="true" />
      </span>
      <span>
        Africa<span className="brand-cod">Cod</span>
      </span>
    </span>
  );
}
export function Badge({
  active = true,
  children,
  tone,
}: {
  active?: boolean;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  children: ReactNode;
}) {
  return (
    <span
      className={`badge ${tone ? `badge-${tone}` : active ? "badge-active" : "badge-inactive"}`}
    >
      <span />
      {children}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {(action || secondaryAction) && (
        <div className="page-heading-actions">
          {secondaryAction}
          {action}
        </div>
      )}
    </div>
  );
}
export function ArrowLink({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
      <ArrowUpRight size={16} />
    </span>
  );
}

// Visual semantics only; these labels never decide commercial or shipment state.
export function StatusBadge({
  status,
  children,
}: {
  status: string;
  children?: ReactNode;
}) {
  const tone = [
    "active",
    "published",
    "connected",
    "confirmed",
    "delivered",
    "fulfilled",
  ].includes(status)
    ? "success"
    : [
          "failed",
          "error",
          "cancelled",
          "delivery_failed",
          "refused",
          "returned",
        ].includes(status)
      ? "danger"
      : [
            "new",
            "pending",
            "processing",
            "ready",
            "uncontacted",
            "attempted",
            "callback_due",
          ].includes(status)
        ? "warning"
        : ["shipped", "out_for_delivery"].includes(status)
          ? "info"
          : "neutral";
  return <Badge tone={tone}>{children ?? status.replaceAll("_", " ")}</Badge>;
}
export function TableScroll({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && (
        <span className="empty-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
