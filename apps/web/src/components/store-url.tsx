"use client";
import { useState } from "react";
export function StoreUrl({ url }: { url: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="stack-form">
      <label>
        Store URL
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <button
        type="button"
        className="button button-outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage("Store URL copied");
          } catch {
            setMessage(
              "Select the Store URL and copy it using your keyboard or device menu.",
            );
          }
        }}
      >
        Copy URL
      </button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}
