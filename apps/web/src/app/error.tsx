"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="standalone-state">
      <h1>Something went wrong.</h1>
      <p>Please try again in a moment.</p>
      <button className="button button-green" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
