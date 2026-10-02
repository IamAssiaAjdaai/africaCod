import { createHmac, timingSafeEqual } from "node:crypto";
import { runtimeEnvironment } from "@africacod/shared";
export const consentCookieName = (store: string) => `ac_consent_${store}`;
export function encodeConsent(
  store: string,
  analytics: boolean,
  marketing: boolean,
) {
  const value = `1.${Number(analytics)}.${Number(marketing)}`;
  return (
    value +
    "." +
    createHmac("sha256", runtimeEnvironment().BETTER_AUTH_SECRET)
      .update(`${store}:${value}`)
      .digest("base64url")
  );
}
export function readConsent(store: string, encoded?: string) {
  if (runtimeEnvironment().CONSENT_MODE === "merchant-managed")
    return { analytics: true, marketing: true };
  if (!encoded || !/^1\.[01]\.[01]\.[A-Za-z0-9_-]{43}$/.test(encoded))
    return { analytics: false, marketing: false };
  const expected = encodeConsent(store, encoded[2] === "1", encoded[4] === "1");
  if (!timingSafeEqual(Buffer.from(encoded), Buffer.from(expected)))
    return { analytics: false, marketing: false };
  return { analytics: encoded[2] === "1", marketing: encoded[4] === "1" };
}
