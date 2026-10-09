import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function DashboardDisclosure({
  title,
  description,
  className = "",
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={`panel dashboard-disclosure ${className}`}>
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="dashboard-disclosure-body">{children}</div>
    </details>
  );
}
