"use client";
export default function StoreError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="store-browse empty-state" role="alert">
      <h1>This Store page could not load.</h1>
      <p>
        Please try again. If you already submitted an order, keep its reference
        and contact the Store before placing another.
      </p>
      <button className="button button-green" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
