"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Package,
  FolderTree,
  Store,
  X,
} from "lucide-react";
import { Brand } from "@africacod/ui";
import { authClient } from "@africacod/auth/client";
const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/pages", label: "Pages", icon: FolderTree },
  { href: "/orders/confirmation", label: "Confirmation", icon: ClipboardCheck },
  { href: "/fulfillment", label: "Fulfillment", icon: Package },
  { href: "/analytics", label: "Analytics", icon: LayoutDashboard },
  { href: "/apps", label: "Apps", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];
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
            <small>Organization workspace</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <div key={href}>
              {href === "/products" && <p className="nav-caption">COMMERCE</p>}
              {href === "/stores" && <p className="nav-caption">STORE</p>}
              {href === "/orders/confirmation" && (
                <p className="nav-caption">OPERATIONS</p>
              )}
              {href === "/apps" && <p className="nav-caption">PLATFORM</p>}
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${activeHref === href ? "selected" : ""}`}
                onClick={() => setOpen(false)}
                aria-current={activeHref === href ? "page" : undefined}
              >
                <Icon size={19} />
                {label}
                {activeHref === href && <span className="nav-dot" />}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-grow">
          <div className="grow-illustration">
            <Store size={24} />
            <ArrowUpRight size={16} />
          </div>
          <strong>Your next market awaits.</strong>
          <p>Big ideas start with a first step.</p>
          <Link href="/stores">
            Explore your stores <ArrowRightIcon />
          </Link>
        </div>
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
          <div className="topbar-right">
            <span className="workspace-status">
              <span className="tiny-dot" /> Your workspace
            </span>
            <Link
              className="button button-outline button-small"
              href="/stores/new"
            >
              <Plus size={15} /> New store
            </Link>
          </div>
        </header>
        <main id="workspace-main" tabIndex={-1} className="workspace-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>AfricaCod · Local roots. Limitless reach.</span>
          <span>
            Made for your next chapter <ArrowUpRight size={12} />
          </span>
        </footer>
      </div>
    </div>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={14} />;
}
