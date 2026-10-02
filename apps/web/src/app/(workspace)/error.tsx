"use client";
import Link from "next/link";
export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="panel empty-state" role="alert">
      <h1>This screen could not load.</h1>
      <p>Your saved work is preserved. Retry, or return to your Dashboard.</p>
      <div className="form-actions">
        <button className="button button-green" onClick={reset}>
          Try again
        </button>
        <Link className="button button-outline" href="/dashboard">
          Dashboard
        </Link>
      </div>
    </section>
  );
}
