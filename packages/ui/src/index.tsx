import { ArrowUpRight, Layers3 } from "lucide-react";
import type { ReactNode } from "react";
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`brand ${dark ? "brand-dark" : ""}`}>
      <span className="brand-mark">
        <Layers3 size={22} />
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
}: {
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`badge ${active ? "badge-active" : "badge-inactive"}`}>
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
