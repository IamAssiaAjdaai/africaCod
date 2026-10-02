import { expect, it } from "vitest";
import { countryCatalog } from "./index";
it("keeps the platform catalog complete and unique", () => {
  expect(new Set(countryCatalog.map((c) => c.code)).size).toBe(10);
  expect(countryCatalog.map((c) => [c.code, c.currencyCode])).toEqual([
    ["KE", "KES"],
    ["GH", "GHS"],
    ["GN", "GNF"],
    ["CI", "XOF"],
    ["SN", "XOF"],
    ["CM", "XAF"],
    ["TZ", "TZS"],
    ["UG", "UGX"],
    ["NG", "NGN"],
    ["MA", "MAD"],
  ]);
  for (const c of countryCatalog) {
    expect(c.callingCode).toMatch(/^\+\d{1,3}$/);
    expect(Intl.getCanonicalLocales(c.defaultLocale)).toEqual([
      c.defaultLocale,
    ]);
  }
});
