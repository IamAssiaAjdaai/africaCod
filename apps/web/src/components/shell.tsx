"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Package,
  ShoppingBag,
  Truck,
  FileText,
  ChartNoAxesCombined,
  Grid2X2,
  FolderTree,
  Store,
  X,
} from "lucide-react";
import { Brand } from "@africacod/ui";
import { authClient } from "@africacod/auth/client";
const navigationGroups = [
  {
    label: "",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { href: "/orders", label: "Orders", icon: ShoppingBag },
      {
        href: "/orders/confirmation",
        label: "Confirmation",
        icon: ClipboardCheck,
      },
      { href: "/fulfillment", label: "Fulfillment", icon: Truck },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/categories", label: "Categories", icon: FolderTree },
    ],
  },
  {
    label: "Storefront",
    items: [
      { href: "/stores", label: "Stores", icon: Store },
      { href: "/pages", label: "Pages", icon: FileText },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/apps", label: "Apps", icon: Grid2X2 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
const navigation = navigationGroups.flatMap((group) => group.items);
export function Shell({
  children,
  organization,
  user,
}: {
  children: React.ReactNode;
  organization: { name: string; role: string };
  user: { name: string; email: string };
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const activeHref =
    path.startsWith("/orders/confirmation") ||
    path.startsWith("/orders/callbacks")
      ? "/orders/confirmation"
      : navigation.find((item) => path.startsWith(item.href))?.href;
  useEffect(() => {
    if (!open) return;
    const opener = menuButton.current;
    const media = window.matchMedia("(max-width: 760px)");
    const main = document.querySelector<HTMLElement>(".app-main");
    if (media.matches && main) main.inert = true;
    const previousOverflow = document.body.style.overflow;
    if (media.matches) document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !media.matches) return;
      const elements = Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled), summary",
        ) ?? [],
      ).filter((element) => element.getClientRects().length);
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    function resize() {
      if (!media.matches) setOpen(false);
    }
    window.addEventListener("keydown", keydown);
    media.addEventListener("change", resize);
    return () => {
      if (main) main.inert = false;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
      media.removeEventListener("change", resize);
      opener?.focus();
    };
  }, [open]);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Could not sign out. Try again.");
        return;
      }
      router.push("/sign-in");
      router.refresh();
    } catch {
      setError("Could not sign out. Try again.");
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        ref={sidebar}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        id="workspace-navigation"
        aria-label="Workspace navigation"
        className={`sidebar ${open ? "sidebar-open" : ""}`}
      >
        <div className="sidebar-brand">
          <Link href="/dashboard">
            <Brand />
          </Link>
          <button
            className="mobile-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <div className="org-card">
          <span className="org-avatar">
            {organization.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{organization.name}</strong>
            <small>
              {organization.role[0].toUpperCase() + organization.role.slice(1)}{" "}
              workspace
            </small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navigationGroups.map((group) => (
            <div className="nav-group" key={group.label || "overview"}>
              {group.label && <p className="nav-caption">{group.label}</p>}
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`sidebar-link ${activeHref === href ? "selected" : ""}`}
                  onClick={() => setOpen(false)}
                  aria-current={activeHref === href ? "page" : undefined}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="user-avatar">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <details className="user-menu">
            <summary>
              {user.name}
              <small>
                {organization.role[0].toUpperCase() +
                  organization.role.slice(1)}
              </small>
            </summary>
            <p>{user.email}</p>
            <Link href="/settings" onClick={() => setOpen(false)}>
              Account settings
            </Link>
          </details>
          <button
            onClick={signOut}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuButton}
              aria-expanded={open}
              aria-controls="workspace-navigation"
              className="mobile-menu"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>
              {navigation.find((item) => item.href === activeHref)?.label ??
                "Stores"}
            </strong>
          </div>
        </header>
        <main id="workspace-main" tabIndex={-1} className="workspace-content">
          {children}
        </main>
        <footer className="workspace-footer">AfricaCod</footer>
      </div>
    </div>
  );
}
