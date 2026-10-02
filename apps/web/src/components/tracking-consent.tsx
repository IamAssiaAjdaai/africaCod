"use client";
import { createContext, useContext, useState } from "react";
const ConsentContext = createContext({ analytics: false, marketing: false });
export const useTrackingConsent = () => useContext(ConsentContext);
export function TrackingConsent({
  storeSlug,
  initial,
  required,
  hasPreference,
  children,
}: {
  storeSlug: string;
  initial: { analytics: boolean; marketing: boolean };
  required: boolean;
  hasPreference: boolean;
  children: React.ReactNode;
}) {
  const [consent, setConsent] = useState(initial),
    [open, setOpen] = useState(required && !hasPreference),
    [error, setError] = useState(false),
    [pending, setPending] = useState(false);
  async function save(analytics: boolean, marketing: boolean) {
    setPending(true);
    setError(false);
    try {
      const response = await fetch(`/api/storefront/${storeSlug}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics, marketing }),
      });
      if (!response.ok) throw new Error();
      setConsent({ analytics, marketing });
      setOpen(false);
      // Reload removes any already-loaded third-party SDK when a preference is withdrawn.
      window.location.reload();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <ConsentContext.Provider value={consent}>
      {children}
      {required && (
        <section className="consent-panel" aria-label="Tracking preferences">
          {open ? (
            <>
              <h2>Tracking preferences</h2>
              <p>
                Essential sign-in and order functions work without optional
                tracking. Choose whether this Store may collect anonymous
                browsing observations and use merchant-enabled marketing tags.
              </p>
              <div className="filter-actions">
                <button
                  className="button button-outline"
                  disabled={pending}
                  onClick={() => save(false, false)}
                >
                  Essential only
                </button>
                <button
                  className="button button-outline"
                  disabled={pending}
                  onClick={() => save(true, false)}
                >
                  Anonymous analytics only
                </button>
                <button
                  className="button button-green"
                  disabled={pending}
                  onClick={() => save(true, true)}
                >
                  Allow optional tracking
                </button>
              </div>
              {error && (
                <p role="alert">
                  Could not save. Your previous tracking preference remains in
                  effect.
                </p>
              )}
            </>
          ) : (
            <button
              className="button button-outline"
              onClick={() => setOpen(true)}
            >
              Tracking preferences
            </button>
          )}
        </section>
      )}
    </ConsentContext.Provider>
  );
}
