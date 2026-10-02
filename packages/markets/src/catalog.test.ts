import { expect, it } from "vitest";
import { countryCatalog, isCatalogCountry } from "./index";
it("includes the complete ISO catalog and supplemental territories with valid defaults", () => {
  expect(countryCatalog).toHaveLength(252);
  expect(new Set(countryCatalog.map((c) => c.code)).size).toBe(252);
  for (const code of ["KE", "RW", "AO", "US", "AQ", "BV", "SS", "XK"])
    expect(countryCatalog.some((c) => c.code === code)).toBe(true);
  for (const c of countryCatalog) {
    expect(c.code).toMatch(/^[A-Z]{2}$/);
    expect(c.currencyCode).toMatch(/^[A-Z]{3}$/);
    if (c.callingCode) expect(c.callingCode).toMatch(/^\+\d{1,4}$/);
    expect(Intl.getCanonicalLocales(c.defaultLocale)).toEqual([
      c.defaultLocale,
    ]);
  }
  expect(countryCatalog.find((c) => c.code === "RW")).toMatchObject({
    currencyCode: "RWF",
    defaultLocale: "rw-RW",
    callingCode: "+250",
  });
  expect(countryCatalog.find((c) => c.code === "AO")).toMatchObject({
    currencyCode: "AOA",
    defaultLocale: "pt-AO",
  });
});
it("recognizes canonical country names, native names, aliases and ISO codes", () => {
  for (const name of [
    "kenya",
    " KE ",
    "KEN",
    "Rwanda",
    "United States",
    "USA",
    "Ivory Coast",
  ])
    expect(isCatalogCountry(name)).toBe(true);
  expect(isCatalogCountry("Special island region")).toBe(false);
});
