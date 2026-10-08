import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
          <Brand />
        </Link>
        <div>
          <h2>Your commerce workspace</h2>
          <p>Manage stores, markets and COD operations in one place.</p>
        </div>
        <small>Made for the way Africa sells.</small>
      </aside>
      <section className="auth-main">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <div className="auth-content">{children}</div>
        <p className="auth-footer">AfricaCod · Commerce across markets</p>
      </section>
    </main>
  );
}
