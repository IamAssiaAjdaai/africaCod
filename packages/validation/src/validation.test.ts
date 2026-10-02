import { describe, expect, it } from "vitest";
import {
  marketInput,
  marketStatusInput,
  organizationInput,
  storeInput,
} from "./index";
describe("boundary validation", () => {
  it("normalizes organization names and rejects empty input", () => {
    expect(organizationInput.parse({ name: "  Assia Commerce  " }).name).toBe(
      "Assia Commerce",
    );
    expect(organizationInput.safeParse({ name: " " }).success).toBe(false);
  });
  it("accepts a store without any country", () => {
    expect(
      storeInput.parse({
        name: "Glow Beauty",
        slug: "glow-beauty",
        country: "KE",
        organizationId: "forged",
      }),
    ).toEqual({ name: "Glow Beauty", slug: "glow-beauty" });
  });
  it.each(["Bad Slug", "glow--beauty", "-glow", "glow-", "api", "www"])(
    "rejects unsafe or reserved slug %s",
    (slug) => {
      expect(storeInput.safeParse({ name: "Glow", slug }).success).toBe(false);
    },
  );
  it("rejects forged identifiers and invalid status/country values", () => {
    expect(
      marketInput.safeParse({ storeId: "invalid", countryCode: "KE" }).success,
    ).toBe(false);
    expect(
      marketStatusInput.safeParse({
        storeId: crypto.randomUUID(),
        marketId: crypto.randomUUID(),
        status: "deleted",
      }).success,
    ).toBe(false);
    expect(
      marketInput.safeParse({
        storeId: crypto.randomUUID(),
        countryCode: "Kenya",
      }).success,
    ).toBe(false);
  });
});
