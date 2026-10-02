import Link from "next/link";
import { ArrowLeft, Globe2 } from "lucide-react";
import { Brand } from "@africacod/ui";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <aside className="auth-story">
        <Link href="/">
          <Brand dark />
        </Link>
        <div>
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h1>
            Local roots.
            <br />
            <em>Limitless reach.</em>
          </h1>
          <p>One home for your stores. A world of possibility across Africa.</p>
          <div className="auth-globe">
            <Globe2 size={150} strokeWidth={0.6} />
            <span className="auth-orbit-dot" />
          </div>
        </div>
        <small>Made for the way Africa sells.</small>
      </aside>
      <section className="auth-main">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <div className="auth-content">{children}</div>
        <p className="auth-footer">A little ambition goes a long way.</p>
      </section>
    </main>
  );
}
