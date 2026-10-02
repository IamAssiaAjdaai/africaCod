import { describe, it, expect } from "vitest";
import {
  checkoutConfiguration,
  normalizeCheckoutPhone,
  validateCheckoutAddress,
} from "./checkout-configuration";
const configuration = (countryCode: string, callingCode: string) =>
  checkoutConfiguration({
    countryCode,
    locale: "en",
    callingCode,
    checkoutConfig: null,
  });
describe("Market checkout configuration", () => {
  it("normalizes Kenyan and Ghanaian national phone numbers", () => {
    expect(
      normalizeCheckoutPhone("0712345678", configuration("KE", "254")),
    ).toBe("+254712345678");
    expect(
      normalizeCheckoutPhone("0241234567", configuration("GH", "233")),
    ).toBe("+233241234567");
  });
  it("rejects malformed/wrong-country phone numbers", () => {
    for (const phone of [
      "12345",
      "+233241234567",
      "hello 0712345678",
      "0712345678 ext 2",
    ])
      expect(() =>
        normalizeCheckoutPhone(phone, configuration("KE", "254")),
      ).toThrow();
  });
  it("provides reusable market-specific labels and required address fields", () => {
    expect(configuration("KE", "254").regionLabel).toBe("County");
    expect(configuration("GH", "233").regionLabel).toBe("Region");
    expect(() =>
      validateCheckoutAddress(
        { region: "", city: "Nairobi", address: "Garden Road" },
        configuration("KE", "254"),
      ),
    ).toThrow();
    expect(() =>
      validateCheckoutAddress(
        { region: "Nairobi", city: "Nairobi", address: "Garden Road" },
        configuration("KE", "254"),
      ),
    ).not.toThrow();
  });
});
