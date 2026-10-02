"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
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
      {open && (
        <button
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
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
          <ChevronDown size={15} />
        </div>
        <nav>
          {navigation.map(({ href, label, icon: Icon }) => (
            <div key={href}>
              {href === "/products" && <p className="nav-caption">COMMERCE</p>}
              {href === "/stores" && <p className="nav-caption">STORE</p>}
              {href === "/settings" && <p className="nav-caption">PLATFORM</p>}
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${path.startsWith(href) ? "selected" : ""}`}
                onClick={() => setOpen(false)}
                aria-current={path.startsWith(href) ? "page" : undefined}
              >
                <Icon size={19} />
                {label}
                {path.startsWith(href) && <span className="nav-dot" />}
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
          <div>
            <strong>{user.name}</strong>
            <small>{organization.role === "owner" ? "Owner" : "Admin"}</small>
          </div>
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
              className="mobile-menu"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>
              {navigation.find((item) => path.startsWith(item.href))?.label ??
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
        <main className="workspace-content">{children}</main>
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
