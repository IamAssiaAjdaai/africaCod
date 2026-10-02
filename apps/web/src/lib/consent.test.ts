import { describe, it, expect, vi, afterEach } from "vitest";
import { encodeConsent, readConsent } from "./consent";
afterEach(() => vi.unstubAllEnvs());
describe("Store-scoped consent", () => {
  it("defaults optional modules off and rejects tampered or another Store's preference", () => {
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("CONSENT_MODE", "required");
    expect(readConsent("store-one")).toEqual({
      analytics: false,
      marketing: false,
    });
    const cookie = encodeConsent("store-one", true, false);
    expect(readConsent("store-one", cookie)).toEqual({
      analytics: true,
      marketing: false,
    });
    expect(
      readConsent("store-one", cookie.replace("1.1.0.", "1.1.1.")),
    ).toEqual({ analytics: false, marketing: false });
    expect(readConsent("store-two", cookie)).toEqual({
      analytics: false,
      marketing: false,
    });
  });
  it("allows an explicitly configured merchant-managed boundary", () => {
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("CONSENT_MODE", "merchant-managed");
    expect(readConsent("store-one")).toEqual({
      analytics: true,
      marketing: true,
    });
  });
});
